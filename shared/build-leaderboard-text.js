// Build text bang xep hang XP top N tu DB (dung chung cho bot worker va dashboard /send-now)
// Khong phu thuoc Discord client: uu tien dung username cached trong bang users.
// Truong hop chua co cached username, caller co the truyen `client` (discord.js) de fetch.

const db = require('./db')

async function buildLeaderboardText(guildId, { limit = 10, client = null } = {}) {
  const topUsers = db.getLeaderboard(guildId, limit)
  if (!topUsers.length) return 'Chưa có ai có điểm XP trong server này. 🦗'

  const medals = ['🥇', '🥈', '🥉']
  const lines = []
  for (let i = 0; i < topUsers.length; i++) {
    const u = topUsers[i]
    let username = u.nickname || u.global_name || u.username
    if (!username && client) {
      try {
        const du = await client.users.fetch(u.id)
        username = du.username
      } catch (_) { /* ignore */ }
    }
    if (!username) username = '(ẩn danh)'
    const prefix = medals[i] || `\`#${i + 1}\``
    lines.push(`${prefix} **${username}** — Lv.**${u.level}** • ${(u.xp || 0).toLocaleString()} XP`)
  }
  return lines.join('\n')
}

// Tron leaderboard vao content cua scheduled message.
// Neu content chua `{leaderboard}` → thay the. Neu khong → noi vao cuoi.
function mergeContentWithLeaderboard(content, leaderboardText) {
  const base = content || ''
  if (base.includes('{leaderboard}')) return base.replace(/\{leaderboard\}/g, leaderboardText)
  if (!base.trim()) return leaderboardText
  return `${base}\n\n${leaderboardText}`
}

module.exports = { buildLeaderboardText, mergeContentWithLeaderboard }
