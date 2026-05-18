// Build payload "Vinh danh Top 3" — Champion Spotlight (Mock 4)
// Title hien thi dang H1 markdown (`# ...`) trong description de chu to nhat Discord cho phep.
// Emoji huy chuong (gold/silver/bronze) co the override bang Discord custom emoji `<:name:id>`.

const GOLD = 0xffd700

// Mac dinh: unicode emoji. Override qua payload.medalEmojis = { gold, silver, bronze }
const DEFAULT_MEDALS = { gold: '🥇', silver: '🥈', bronze: '🥉' }

// Escape ky tu markdown trong reason de tranh user inject
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
 * @param {Object} p
 * @param {string} p.title
 * @param {string} p.guildName
 * @param {string} [p.guildIconUrl]
 * @param {{id, name, avatarUrl?, reason}} p.user1
 * @param {{id, name, avatarUrl?, reason}} p.user2
 * @param {{id, name, avatarUrl?, reason}} p.user3
 * @param {string} p.bannerUrl
 * @param {{gold?, silver?, bronze?}} [p.medalEmojis]  - Override emoji huy chuong
 * @returns {{ content, embeds }}
 */
function buildHonorEmbed(p) {
  const title = ensureString(p.title, 'title')
  const guildName = ensureString(p.guildName, 'guildName')
  const bannerUrl = ensureString(p.bannerUrl, 'bannerUrl')
  const u1 = ensureUser(p.user1, 'user1')
  const u2 = ensureUser(p.user2, 'user2')
  const u3 = ensureUser(p.user3, 'user3')

  const medals = {
    gold: (p.medalEmojis?.gold || DEFAULT_MEDALS.gold),
    silver: (p.medalEmojis?.silver || DEFAULT_MEDALS.silver),
    bronze: (p.medalEmojis?.bronze || DEFAULT_MEDALS.bronze),
  }

  // Layout:
  //   ## BẢNG VÀNG (H2 — be hon H1 nhung van lon hon cac thanh phan khac)
  //   ### {medal} QUÁN QUÂN — Name (H3 inline emoji + ten, cung 1 dong)
  //   > quote reason
  const description = [
    `## ${title}`,
    `### ${medals.gold} QUÁN QUÂN — ${u1.name}`,
    `> *"${escapeMd(u1.reason)}"*`,
  ].join('\n')

  const embed = {
    ...(p.guildIconUrl ? { author: { name: guildName, icon_url: p.guildIconUrl } } : {}),
    description,
    color: GOLD,
    ...(u1.avatarUrl ? { thumbnail: { url: u1.avatarUrl } } : {}),
    fields: [
      {
        name: `${medals.silver} Á QUÂN`,
        value: `**${u2.name}**\n${escapeMd(u2.reason)}`,
        inline: true,
      },
      {
        name: `${medals.bronze} HẠNG BA`,
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

module.exports = { buildHonorEmbed, escapeMd, DEFAULT_MEDALS }
