// Quet member trong server chua chat lan nao, luu vao DB.
// Dung chung cho dashboard (manual scan) va bot (cron daily).
const db = require('./db')

async function scanSilentMembers(guildId) {
  if (!process.env.BOT_TOKEN) throw new Error('BOT_TOKEN chua duoc cau hinh')

  const allMembers = []
  let after = '0'
  for (let i = 0; i < 10; i++) { // toi da 10 trang = 10k member
    const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`, {
      headers: { 'Authorization': `Bot ${process.env.BOT_TOKEN}` },
    })
    if (!r.ok) {
      const errText = await r.text()
      throw new Error(`Discord API ${r.status}: ${errText.slice(0, 200)}`)
    }
    const batch = await r.json()
    if (!batch.length) break
    allMembers.push(...batch)
    after = batch[batch.length - 1].user.id
    if (batch.length < 1000) break
  }

  const chattedIds = new Set(db.getAllUsers(guildId).map(u => u.id))
  const silent = allMembers
    .filter(m => m.user && !m.user.bot && !chattedIds.has(m.user.id))
    .map(m => ({
      user_id: m.user.id,
      username: m.user.username,
      global_name: m.user.global_name || null,
      nickname: m.nick || null,
      avatar: m.user.avatar || null,
      joined_at: m.joined_at,
    }))

  db.replaceSilentMembers(guildId, silent)
  return { total: silent.length, scanned_at: Math.floor(Date.now() / 1000) }
}

module.exports = { scanSilentMembers }
