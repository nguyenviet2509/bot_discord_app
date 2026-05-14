const { EmbedBuilder } = require('discord.js')
const db = require('../../../shared/db')

// ─── Level Formula ────────────────────────────────────────────────────────────
// Mỗi 10 level là 1 bracket. Số tin nhắn cần để lên MỖI level trong từng bracket:
//   bracket 1  (lvl 1-10):   50 msg/level
//   bracket 2  (lvl 11-20):  100 msg/level
//   bracket 3  (lvl 21-30):  120 msg/level
//   bracket 4  (lvl 31-40):  140 msg/level
//   bracket 5  (lvl 41-50):  160 msg/level
//   bracket 6  (lvl 51-60):  260 msg/level  (= 160 + 100)
//   bracket 7  (lvl 61-70):  460 msg/level  (= 260 + 200)
//   bracket 8  (lvl 71-80):  760 msg/level  (= 460 + 300)
//   bracket 9  (lvl 81-90):  1160 msg/level (= 760 + 400)
//   bracket 10 (lvl 91-100): 1660 msg/level (= 1160 + 500)
// XP threshold = msgs × AVG_XP_PER_MSG (xp_min=15, xp_max=25 mặc định → avg 20).
const AVG_XP_PER_MSG = 20
const LEVELS_PER_BRACKET = 10
const BRACKET_MSGS_PER_LEVEL = [50, 100, 120, 140, 160, 260, 460, 760, 1160, 1660]
// Bracket vượt quá 10 (level > 100) → giữ giá trị bracket cuối
const LAST_BRACKET_MSGS = BRACKET_MSGS_PER_LEVEL[BRACKET_MSGS_PER_LEVEL.length - 1]

// Tier milestones matching League-style ranks
const LEVEL_TIERS = [
  { minLevel: 100, name: 'Thách Đấu',  color: 0xff4655, badge: '🔴' },
  { minLevel: 90,  name: 'Đại Cao Thủ',color: 0xff6d00, badge: '🟠' },
  { minLevel: 80,  name: 'Cao Thủ',    color: 0x9b27af, badge: '🟣' },
  { minLevel: 70,  name: 'Kim Cương',  color: 0x0288d1, badge: '🔵' },
  { minLevel: 60,  name: 'Lục Bảo',   color: 0x2e7d32, badge: '🟢' },
  { minLevel: 50,  name: 'Bạch Kim',  color: 0x00838f, badge: '🩵' },
  { minLevel: 40,  name: 'Vàng',       color: 0xf9a825, badge: '🟡' },
  { minLevel: 30,  name: 'Bạc',        color: 0x78909c, badge: '⚪' },
  { minLevel: 20,  name: 'Đồng',       color: 0xbf360c, badge: '🟤' },
  { minLevel: 10,  name: 'Sắt',        color: 0x546e7a, badge: '⚫' },
]

function getTierForLevel(level) {
  for (const tier of LEVEL_TIERS) {
    if (level >= tier.minLevel) return tier
  }
  return { minLevel: 0, name: 'Chưa xếp hạng', color: 0x6b7280, badge: '▫️' }
}

// Msg/level của bracket chứa target level (1-indexed)
function bracketMsgsForTarget(target) {
  const idx = Math.ceil(target / LEVELS_PER_BRACKET) - 1 // 0-indexed
  if (idx < 0) return BRACKET_MSGS_PER_LEVEL[0]
  if (idx >= BRACKET_MSGS_PER_LEVEL.length) return LAST_BRACKET_MSGS
  return BRACKET_MSGS_PER_LEVEL[idx]
}

// Số tin nhắn cần để lên level (target = currentLevel + 1)
function msgsForNextLevel(currentLevel) {
  const target = Math.max(currentLevel + 1, 1)
  return bracketMsgsForTarget(target)
}

// XP cần để lên level kế tiếp
function xpForNextLevel(currentLevel) {
  return msgsForNextLevel(currentLevel) * AVG_XP_PER_MSG
}

// Tổng XP cần để đạt level n (từ level 0) — cộng dồn theo từng bracket
function totalXpToReachLevel(n) {
  if (n <= 0) return 0
  let totalMsgs = 0
  let remaining = n
  for (let i = 0; remaining > 0; i++) {
    const bracketCost =
      i < BRACKET_MSGS_PER_LEVEL.length ? BRACKET_MSGS_PER_LEVEL[i] : LAST_BRACKET_MSGS
    const levelsInThisBracket = Math.min(remaining, LEVELS_PER_BRACKET)
    totalMsgs += levelsInThisBracket * bracketCost
    remaining -= levelsInThisBracket
  }
  return totalMsgs * AVG_XP_PER_MSG
}

// Keep for backward compat (returns same as totalXpToReachLevel)
function xpForLevel(level) {
  return totalXpToReachLevel(level)
}

// Determine current level from total XP (iterative, safe for any XP value)
function levelFromXp(totalXp) {
  let level = 0
  while (totalXpToReachLevel(level + 1) <= totalXp) level++
  return level
}

// Progress within the current level
function getXpProgress(totalXp, level) {
  const currentThreshold = totalXpToReachLevel(level)
  const nextThreshold = totalXpToReachLevel(level + 1)
  const progress = totalXp - currentThreshold
  const needed = nextThreshold - currentThreshold
  const percent = needed > 0 ? Math.min(Math.floor((progress / needed) * 100), 100) : 100
  return { progress, needed, percent }
}

function buildProgressBar(percent, length = 10) {
  const filled = Math.floor((percent / 100) * length)
  return '█'.repeat(filled) + '░'.repeat(length - filled)
}

async function handleLevelUp(client, guild, member, newLevel, settings) {
  const rewards = db.getRewards(guild.id)

  // Assign roles: type='role' OR badge có kèm role_id
  const roleRewards = rewards.filter(r => r.role_id && r.level_required <= newLevel)
  for (const reward of roleRewards) {
    try {
      if (!member.roles.cache.has(reward.role_id)) {
        await member.roles.add(reward.role_id)
      }
    } catch (err) {
      console.error(`[LevelService] Failed to assign role ${reward.role_id}:`, err.message)
    }
  }

  // Send level-up notification
  const channelId = settings?.level_up_channel_id || process.env.LEVELUP_CHANNEL_ID
  if (!channelId) return

  const channel = guild.channels.cache.get(channelId)
  if (!channel) return

  const user = db.getUser(member.id, guild.id)
  const { percent } = getXpProgress(user.xp, newLevel)
  const bar = buildProgressBar(percent)
  const tier = getTierForLevel(newLevel)
  const isMilestone = LEVEL_TIERS.some(t => t.minLevel === newLevel)
  const tpl = db.getLevelUpTemplate(guild.id)

  // Reward tại đúng level vừa lên (role | badge | cả 2)
  const rewardAtLevel = rewards.filter(r => r.level_required === newLevel)
  const roleRewardAtLevel = rewardAtLevel.find(r => r.type === 'role')
  const badgeReward = rewardAtLevel.find(r => r.type === 'badge')
  // Role kèm trong badge (feature mới)
  const badgeRoleId = badgeReward?.role_id

  // Thay placeholder
  const fill = (str) => str
    .replace(/\{user\}/g, member.user.username)
    .replace(/\{level\}/g, String(newLevel))
    .replace(/\{tier\}/g, tier.name)
    .replace(/\{tier_badge\}/g, tier.badge)
    .replace(/\{xp\}/g, user.xp.toLocaleString())

  const color = tpl.color_mode === 'custom'
    ? parseInt((tpl.custom_color || '#6366f1').replace('#', ''), 16)
    : tier.color

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(fill(tpl.title))
    .setDescription(fill(isMilestone ? tpl.milestone_description : tpl.description))
    .setTimestamp()

  if (tpl.show_avatar) {
    embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
  }

  const fields = []
  if (tpl.show_tier_field) fields.push({ name: 'Danh hiệu', value: `${tier.badge} ${tier.name}`, inline: true })
  if (tpl.show_xp_field) fields.push({ name: 'Tổng XP', value: `${user.xp.toLocaleString()} XP`, inline: true })
  if (tpl.show_progress_field) fields.push({ name: 'Tiến độ', value: `[${bar}] ${percent}%`, inline: true })
  if (fields.length) embed.addFields(...fields)

  if (tpl.show_role_reward) {
    // Role chính (type=role) HOẶC role kèm trong badge
    const roleIdToShow = roleRewardAtLevel?.role_id || badgeRoleId
    if (roleIdToShow) {
      const role = guild.roles.cache.get(roleIdToShow)
      if (role) embed.addFields({ name: '🏅 Nhận được role', value: role.toString(), inline: false })
    }
  }

  if (tpl.show_badge_reward && badgeReward) {
    embed.addFields({
      name: '🖼️ Huy hiệu mới',
      value: badgeReward.badge_name || 'Badge',
      inline: false,
    })

    if (tpl.show_badge_image && badgeReward.badge_url) {
      const base = process.env.BASE_URL || ''
      if (base) embed.setImage(`${base}${badgeReward.badge_url}`)
    }
  }

  try {
    const content = tpl.mention_user ? `<@${member.id}>` : ''
    await channel.send({ content, embeds: [embed] })
  } catch (err) {
    console.error('[LevelService] Failed to send level-up message:', err.message)
  }
}

module.exports = {
  xpForLevel,
  xpForNextLevel,
  totalXpToReachLevel,
  levelFromXp,
  getXpProgress,
  buildProgressBar,
  getTierForLevel,
  LEVEL_TIERS,
  AVG_XP_PER_MSG,
  LEVELS_PER_BRACKET,
  BRACKET_MSGS_PER_LEVEL,
  msgsForNextLevel,
  handleLevelUp,
}
