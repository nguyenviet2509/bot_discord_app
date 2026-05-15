// ─── Tier Flair Service ───────────────────────────────────────────────────────
// Quan ly emoji tier kem theo nickname member khi ho chat.
// Trigger: khi member len tier moi (level 10/20/.../100).
// Cho phep admin custom badge per-guild per-tier qua bang guild_tier_badges.
// Cho phep user opt-out qua /flair off (flag users.flair_enabled).

const { LEVEL_TIERS, getTierForLevel } = require('./level-service')
const db = require('../../../shared/db')

// Generic regex: bat trailing emoji (kem ZWJ + variation selector + skin tone)
// \p{Extended_Pictographic} bao quat moi Unicode emoji standard.
const STRIP_REGEX = /\s*(?:[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]+\s*)+$/u

// Validate input emoji tu admin: chi cho phep Unicode emoji, do dai <= 8
// (loai tru custom Discord emoji <:name:id> va text thuong)
const VALID_EMOJI_REGEX = /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]+$/u

function isValidBadge(input) {
  if (!input || typeof input !== 'string') return false
  if (input.length > 8) return false
  return VALID_EMOJI_REGEX.test(input)
}

// Xoa moi trailing emoji o cuoi ten (de tranh accumulate badge khi len tier moi)
function stripTierBadges(name) {
  if (!name) return ''
  return name.replace(STRIP_REGEX, '').trim()
}

// Lay badge cho 1 tier: uu tien override per-guild, fallback tier.badge mac dinh
function getBadgeForTier(guildId, tier) {
  if (!tier?.badge) return null
  const overrides = db.getTierBadgeOverrides(guildId)
  return overrides.get(tier.minLevel) || tier.badge
}

// Tao nickname moi = base + ' ' + badge, dam bao <= 32 ky tu (Discord limit)
function buildFlairNickname(baseName, badge) {
  const base = stripTierBadges(baseName)
  let nick = `${base} ${badge}`
  if (nick.length <= 32) return nick
  const maxBase = 32 - badge.length - 1
  return `${base.slice(0, maxBase).trim()} ${badge}`
}

// Ap dung flair cho 1 member dua tren level hien tai
// Return: true neu da apply / khong can apply; false neu skip do edge case
async function applyTierFlair(member, newLevel, user) {
  if (!user || user.flair_enabled === 0) return false
  if (newLevel < 10) return false
  const tier = getTierForLevel(newLevel)
  const badge = getBadgeForTier(member.guild.id, tier)
  if (!badge) return false
  if (!member.manageable) {
    console.warn(`[Flair] Skip ${member.id}: not manageable (owner hoac role cao hon bot)`)
    return false
  }
  const baseRaw = member.nickname || member.user.globalName || member.user.username
  const newNick = buildFlairNickname(baseRaw, badge)
  if (newNick === member.nickname) return true
  try {
    await member.setNickname(newNick, 'Tier flair update')
    return true
  } catch (err) {
    console.warn(`[Flair] setNickname fail ${member.id}:`, err.message)
    return false
  }
}

// Xoa emoji khoi nick (dung khi user opt-out)
async function removeFlair(member) {
  if (!member.nickname) return true
  const stripped = stripTierBadges(member.nickname)
  if (stripped === member.nickname) return true
  if (!member.manageable) return false
  try {
    await member.setNickname(stripped || null, 'Flair opt-out / reset')
    return true
  } catch (err) {
    console.warn(`[Flair] removeFlair fail ${member.id}:`, err.message)
    return false
  }
}

module.exports = {
  isValidBadge,
  stripTierBadges,
  buildFlairNickname,
  getBadgeForTier,
  applyTierFlair,
  removeFlair,
}
