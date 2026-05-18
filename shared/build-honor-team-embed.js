// Build payload "Vinh danh team" — Team Roster layout
// N <= 5: 1 field doc | N 6-10: 2 field inline (ceil + floor)
const { escapeMd } = require('./build-honor-embed')

const GOLD = 0xffd700

function ensureString(v, name) {
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Missing or invalid field: ${name}`)
  }
  return v.trim()
}

/**
 * Build payload Team Roster.
 * @param {Object} p
 * @param {string} p.title
 * @param {string} p.guildName
 * @param {string} [p.guildIconUrl]
 * @param {string} p.teamName
 * @param {string} p.reason
 * @param {string} p.bannerUrl
 * @param {Array<{id: string, name?: string}>} p.members  - 1..10
 * @returns {{ content, embeds }}
 */
function buildHonorTeamEmbed(p) {
  const title = ensureString(p.title, 'title')
  const guildName = ensureString(p.guildName, 'guildName')
  const teamName = ensureString(p.teamName, 'teamName')
  const reason = ensureString(p.reason, 'reason')
  const bannerUrl = ensureString(p.bannerUrl, 'bannerUrl')
  const members = Array.isArray(p.members) ? p.members.filter(m => m && m.id) : []
  if (members.length < 1 || members.length > 10) {
    throw new Error(`members phải có 1-10 phần tử (hiện tại: ${members.length})`)
  }

  // Build fields layout
  const fields = []
  if (members.length <= 5) {
    fields.push({
      name: `👥 Thành viên (${members.length})`,
      value: members.map(m => `✨ <@${m.id}>`).join('\n'),
      inline: false,
    })
  } else {
    const half = Math.ceil(members.length / 2)
    fields.push({
      name: `👥 Thành viên (cột 1)`,
      value: members.slice(0, half).map(m => `✨ <@${m.id}>`).join('\n'),
      inline: true,
    })
    fields.push({
      name: `👥 Thành viên (cột 2)`,
      value: members.slice(half).map(m => `✨ <@${m.id}>`).join('\n'),
      inline: true,
    })
  }

  // Layout: H2 title -> H3 🎖️ team name (cung 1 dong) -> quote
  const description = [
    `## ${title}`,
    `### 🎖️ ${teamName}`,
    `> *"${escapeMd(reason)}"*`,
  ].join('\n')

  const embed = {
    ...(p.guildIconUrl ? { author: { name: guildName, icon_url: p.guildIconUrl } } : {}),
    description,
    color: GOLD,
    fields,
    image: { url: bannerUrl },
    footer: { text: `✦ ${members.length} thành viên · Vinh danh bởi ${guildName} ✦` },
    timestamp: new Date().toISOString(),
  }

  const mentions = members.map(m => `<@${m.id}>`).join(' ')
  const content = `🎉 Vinh danh team **${teamName}** — ${mentions} 🎉`

  return { content, embeds: [embed] }
}

module.exports = { buildHonorTeamEmbed }
