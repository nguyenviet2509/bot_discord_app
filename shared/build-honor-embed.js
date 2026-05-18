// Build payload "Vinh danh Top 3" theo layout Mock 4 — Champion Spotlight
// Dung chung cho bot (gui that) va dashboard (preview).
// Output: { content, embeds } — paste truc tiep vao channel.send() hoac interaction.reply()

const GOLD = 0xffd700

// Escape ky tu markdown trong reason de tranh user inject (vd **, __, `, |)
function escapeMd(text) {
  if (!text) return ''
  return String(text).replace(/([\\*_`~|>])/g, '\\$1')
}

function ensureString(v, name) {
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Missing or invalid field: ${name}`)
  }
  return v.trim()
}

function ensureUser(u, name) {
  if (!u || typeof u !== 'object') throw new Error(`Missing user object: ${name}`)
  ensureString(u.id, `${name}.id`)
  ensureString(u.name, `${name}.name`)
  ensureString(u.reason, `${name}.reason`)
  return u
}

/**
 * Build payload "Vinh danh" Champion Spotlight.
 * @param {Object} p
 * @param {string} p.title              - Tieu de (vd "BANG VANG THANG 5/2026")
 * @param {string} p.guildName          - Ten guild (footer)
 * @param {string} [p.guildIconUrl]     - Icon guild cho author
 * @param {{id, name, avatarUrl?, reason}} p.user1 - quan quan
 * @param {{id, name, avatarUrl?, reason}} p.user2 - a quan
 * @param {{id, name, avatarUrl?, reason}} p.user3 - hang ba
 * @param {string} p.bannerUrl          - URL anh banner
 * @returns {{ content: string, embeds: Array }}
 */
function buildHonorEmbed(p) {
  const title = ensureString(p.title, 'title')
  const guildName = ensureString(p.guildName, 'guildName')
  const bannerUrl = ensureString(p.bannerUrl, 'bannerUrl')
  const u1 = ensureUser(p.user1, 'user1')
  const u2 = ensureUser(p.user2, 'user2')
  const u3 = ensureUser(p.user3, 'user3')

  const embed = {
    author: {
      name: `🏛️ ${title}`,
      ...(p.guildIconUrl ? { icon_url: p.guildIconUrl } : {}),
    },
    title: `🥇 QUÁN QUÂN — ${u1.name}`,
    description: `> *"${escapeMd(u1.reason)}"*`,
    color: GOLD,
    ...(u1.avatarUrl ? { thumbnail: { url: u1.avatarUrl } } : {}),
    fields: [
      {
        name: '🥈 Á QUÂN',
        value: `**${u2.name}**\n${escapeMd(u2.reason)}`,
        inline: true,
      },
      {
        name: '🥉 HẠNG BA',
        value: `**${u3.name}**\n${escapeMd(u3.reason)}`,
        inline: true,
      },
    ],
    image: { url: bannerUrl },
    footer: { text: `✦ Vinh danh bởi ${guildName} ✦` },
    timestamp: new Date().toISOString(),
  }

  const content = `🎉 Chúc mừng <@${u1.id}> <@${u2.id}> <@${u3.id}> 🎉`

  return { content, embeds: [embed] }
}

module.exports = { buildHonorEmbed, escapeMd }
