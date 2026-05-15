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

// Lay config cho 1 tier: { mode, badge, role_id, icon_url }
// Fallback ve emoji default neu khong co override
function getTierConfig(guildId, tier) {
  if (!tier?.badge) return null
  const overrides = db.getTierBadgeOverrides(guildId)
  const ov = overrides.get(tier.minLevel)
  if (ov) return ov
  return { mode: 'emoji', badge: tier.badge, role_id: null, icon_url: null }
}

// Backward compat: tra ve emoji string (de cac noi cu khong gay)
function getBadgeForTier(guildId, tier) {
  const cfg = getTierConfig(guildId, tier)
  return cfg ? cfg.badge : null
}

// Tao nickname moi = base + ' ' + badge, dam bao <= 32 ky tu (Discord limit)
function buildFlairNickname(baseName, badge) {
  const base = stripTierBadges(baseName)
  let nick = `${base} ${badge}`
  if (nick.length <= 32) return nick
  const maxBase = 32 - badge.length - 1
  return `${base.slice(0, maxBase).trim()} ${badge}`
}

// Sync tier roles: assign role cua tier hien tai, gỡ role cua tat ca tier khac
// Dung cho mode='role'. Lay danh sach tat ca role tier tu DB overrides.
async function syncTierRoles(member, currentTierMinLevel) {
  const overrides = db.getTierBadgeOverrides(member.guild.id)
  const allTierRoleIds = new Set()
  let currentRoleId = null
  for (const [minLevel, cfg] of overrides.entries()) {
    if (cfg.mode === 'role' && cfg.role_id) {
      allTierRoleIds.add(cfg.role_id)
      if (minLevel === currentTierMinLevel) currentRoleId = cfg.role_id
    }
  }
  // Go role tier cu (khac role tier hien tai)
  for (const roleId of allTierRoleIds) {
    if (roleId === currentRoleId) continue
    if (member.roles.cache.has(roleId)) {
      try { await member.roles.remove(roleId, 'Tier flair: gỡ tier role cũ') }
      catch (err) { console.warn(`[Flair] Remove role ${roleId} fail:`, err.message) }
    }
  }
  // Gan role tier moi
  if (currentRoleId && !member.roles.cache.has(currentRoleId)) {
    try { await member.roles.add(currentRoleId, 'Tier flair: gán tier role mới') }
    catch (err) {
      console.warn(`[Flair] Add role ${currentRoleId} fail:`, err.message)
      return false
    }
  }
  return true
}

// Ap dung flair cho 1 member dua tren level hien tai
// Mode 'emoji' -> sua nickname. Mode 'role' -> assign tier role.
async function applyTierFlair(member, newLevel, user) {
  if (!user || user.flair_enabled === 0) return false
  if (newLevel < 10) return false
  const tier = getTierForLevel(newLevel)
  const cfg = getTierConfig(member.guild.id, tier)
  if (!cfg) return false

  if (cfg.mode === 'role') {
    // Role icon mode: assign role + go cac tier role cu
    return await syncTierRoles(member, tier.minLevel)
  }

  // Emoji mode (default)
  const badge = cfg.badge
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
  getTierConfig,
  syncTierRoles,
  applyTierFlair,
  removeFlair,
}
