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

// Sync role-reward theo level: chỉ giữ role-reward có level_required cao nhất ≤ level,
// remove các role-reward khác mà member đang giữ. Dùng chung cho level-up tự nhiên & admin /set-level.
async function syncLevelRoles(member, level, rewards) {
  const roleRewards = rewards.filter(r => r.role_id)
  if (roleRewards.length === 0) return

  const managedRoleIds = new Set(roleRewards.map(r => r.role_id))
  const eligible = roleRewards.filter(r => r.level_required <= level)
  const top = eligible.length
    ? eligible.reduce((a, b) => (b.level_required > a.level_required ? b : a))
    : null
  const targetRoleId = top?.role_id || null

  if (targetRoleId && !member.roles.cache.has(targetRoleId)) {
    try {
      await member.roles.add(targetRoleId)
    } catch (err) {
      console.error(`[LevelService] Failed to assign role ${targetRoleId}:`, err.message)
    }
  }

  for (const rid of managedRoleIds) {
    if (rid === targetRoleId) continue
    if (!member.roles.cache.has(rid)) continue
    try {
      await member.roles.remove(rid)
    } catch (err) {
      console.error(`[LevelService] Failed to remove role ${rid}:`, err.message)
    }
  }
}

async function handleLevelUp(client, guild, member, newLevel, settings, triggerMessage = null, oldLevel = 0) {
  const rewards = db.getRewards(guild.id)
  await syncLevelRoles(member, newLevel, rewards)

  // Channel thong bao level-up (config tu dashboard hoac env)
  const channelId = settings?.level_up_channel_id || process.env.LEVELUP_CHANNEL_ID
  const channel = channelId ? guild.channels.cache.get(channelId) : null
  // Channel ma bot se reply truc tiep vao message user khi lon cap
  const replyChannelId = settings?.level_up_reply_channel_id || null
  if (!channel && !(triggerMessage && replyChannelId && triggerMessage.channel.id === replyChannelId)) return

  const user = db.getUser(member.id, guild.id)
  const { percent } = getXpProgress(user.xp, newLevel)
  const bar = buildProgressBar(percent)
  const tpl = db.getLevelUpTemplate(guild.id)

  // Reward tại đúng level vừa lên (role | badge | cả 2)
  const rewardAtLevel = rewards.filter(r => r.level_required === newLevel)
  const roleRewardAtLevel = rewardAtLevel.find(r => r.type === 'role')
  const badgeReward = rewardAtLevel.find(r => r.type === 'badge')
  // Role kèm trong badge
  const badgeRoleId = badgeReward?.role_id
  const isMilestone = rewardAtLevel.length > 0

  // Ten reward de chen vao placeholder {reward}
  let rewardName = ''
  if (badgeReward?.badge_name) rewardName = badgeReward.badge_name
  else if (roleRewardAtLevel) {
    const role = guild.roles.cache.get(roleRewardAtLevel.role_id)
    rewardName = role ? role.name : ''
  }

  const fill = (str) => (str || '')
    .replace(/\{user\}/g, member.user.username)
    .replace(/\{level\}/g, String(newLevel))
    .replace(/\{xp\}/g, user.xp.toLocaleString())
    .replace(/\{reward\}/g, rewardName)
    // Strip legacy tier placeholders
    .replace(/\{tier(_badge)?\}/g, '')

  const color = tpl.color_mode === 'custom'
    ? parseInt((tpl.custom_color || '#6366f1').replace('#', ''), 16)
    : 0x6366f1

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(fill(tpl.title))
    .setDescription(fill(isMilestone ? tpl.milestone_description : tpl.description))
    .setTimestamp()

  if (tpl.show_avatar) {
    embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
  }

  const fields = []
  // "Field Phan thuong" (tpl.show_tier_field repurposed)
  if (tpl.show_tier_field && rewardName) {
    fields.push({ name: 'Phần thưởng', value: rewardName, inline: true })
  }
  if (tpl.show_xp_field) fields.push({ name: 'Tổng XP', value: `${user.xp.toLocaleString()} XP`, inline: true })
  if (tpl.show_progress_field) fields.push({ name: 'Tiến độ', value: `[${bar}] ${percent}%`, inline: true })
  if (fields.length) embed.addFields(...fields)

  if (tpl.show_role_reward) {
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

  const content = tpl.mention_user ? `<@${member.id}>` : ''
  const shouldReply = triggerMessage && replyChannelId && triggerMessage.channel.id === replyChannelId

  // Auto-reply vao message goc (neu user chat trong channel duoc cau hinh)
  if (shouldReply) {
    try {
      await triggerMessage.reply({
        content,
        embeds: [embed],
        allowedMentions: { repliedUser: tpl.mention_user !== false },
      })
    } catch (err) {
      console.error('[LevelService] Failed to reply level-up message:', err.message)
    }
  }

  // Luon gui vao channel thong bao level-up (neu co cau hinh).
  // Khi reply channel trung voi notification channel -> tranh gui trung lap.
  if (channel && !(shouldReply && channel.id === triggerMessage.channel.id)) {
    try {
      await channel.send({ content, embeds: [embed] })
    } catch (err) {
      console.error('[LevelService] Failed to send level-up message:', err.message)
    }
  }
}

// Lay config auto-react cho level vua dat duoc
// Tra ve { emoji, chancePct } — emoji null neu chua xep hang hoac tier do bi tat
function getLevelupReactConfig(guildId, level) {
  const tier = getTierForLevel(level)
  if (!tier?.minLevel) return { emoji: null, chancePct: 0 }
  const cfg = db.getLevelupReactConfig(guildId, tier.minLevel)
  return {
    emoji: cfg.emoji ?? tier.badge, // fallback default badge neu chua config
    chancePct: cfg.chancePct,
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
  syncLevelRoles,
  getLevelupReactConfig,
}
