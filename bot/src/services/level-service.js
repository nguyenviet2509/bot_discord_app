const { EmbedBuilder } = require('discord.js')
const db = require('../../../shared/db')

// ─── Level Formula ────────────────────────────────────────────────────────────
// XP needed to go from level L to L+1 = LEVEL_XP_BASE * max(L, 1)
// With default settings (avg 20 XP/msg):
//   • Level 1 → 2: 20,000 XP  → 10 messages = 1% progress
//   • Level 10 → 11: 200,000 XP → 10 messages = 0.1% progress
// Admin can increase xp_min/xp_max in Settings to speed up progression.
const LEVEL_XP_BASE = 20000

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

// Total XP needed to reach level n from level 0:
// = LEVEL_XP_BASE * (1 + (n-1)*n/2)   for n >= 1
// = 0                                   for n = 0
function totalXpToReachLevel(n) {
  if (n <= 0) return 0
  return LEVEL_XP_BASE * (1 + (n - 1) * n / 2)
}

// XP needed to go from currentLevel to currentLevel+1
function xpForNextLevel(currentLevel) {
  return LEVEL_XP_BASE * Math.max(currentLevel, 1)
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

  // Assign all role rewards earned up to this level
  const roleRewards = rewards.filter(r => r.type === 'role' && r.level_required <= newLevel)
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

  const roleRewardAtLevel = rewards.find(r => r.type === 'role' && r.level_required === newLevel)
  const badgeReward = rewards.find(r => r.type === 'badge' && r.level_required === newLevel)

  const embed = new EmbedBuilder()
    .setColor(tier.color)
    .setTitle('🎉 Level Up!')
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setDescription(
      isMilestone
        ? `Chúc mừng **${member.user.username}** đã đạt **Level ${newLevel}**!\n${tier.badge} Đạt danh hiệu **${tier.name}**!`
        : `Chúc mừng **${member.user.username}** đã đạt **Level ${newLevel}**!`
    )
    .addFields(
      { name: 'Danh hiệu', value: `${tier.badge} ${tier.name}`, inline: true },
      { name: 'Tổng XP', value: `${user.xp.toLocaleString()} XP`, inline: true },
      { name: 'Tiến độ', value: `[${bar}] ${percent}%`, inline: true },
    )
    .setTimestamp()

  if (roleRewardAtLevel) {
    const role = guild.roles.cache.get(roleRewardAtLevel.role_id)
    if (role) {
      embed.addFields({ name: '🏅 Nhận được role', value: role.toString(), inline: false })
    }
  }

  if (badgeReward) {
    embed.addFields({
      name: '🖼️ Huy hiệu mới',
      value: badgeReward.badge_name || 'Badge',
      inline: false,
    })

    if (badgeReward.badge_url) {
      const base = process.env.BASE_URL || ''
      if (base) {
        embed.setImage(`${base}${badgeReward.badge_url}`)
      }
    }
  }

  try {
    await channel.send({ content: `<@${member.id}>`, embeds: [embed] })
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
  LEVEL_XP_BASE,
  handleLevelUp,
}
