const db = require('../../../shared/db')
const { levelFromXp, handleLevelUp, getTierForLevel } = require('../services/level-service')

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi

const DEFAULT_SETTINGS = {
  xp_min: 15,
  xp_max: 25,
  cooldown_seconds: 60,
  level_up_channel_id: null,
}

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return
    if (!message.guild) return

    // Analytics counters (chay cho moi message khong filter length)
    try {
      const now = new Date()
      db.incrementActivity(message.guild.id, now.getDay(), now.getHours())
      db.incrementChannelStat(message.guild.id, message.channel.id, message.channel?.name || null)
      // Xoa user khoi silent list (vi ho da chat)
      db.removeSilentMember(message.guild.id, message.author.id)
    } catch (err) {
      console.error('[Analytics] increment fail:', err.message)
    }

    if (message.content.length < 5) return

    const nowSec = Math.floor(Date.now() / 1000)
    const userId = message.author.id
    const guildId = message.guild.id

    const settings = db.getSettings(guildId) || DEFAULT_SETTINGS
    const cooldown = settings.cooldown_seconds || 60

    let user = db.getUser(userId, guildId)
    if (!user) {
      user = { id: userId, guild_id: guildId, xp: 0, level: 0, last_message_at: null }
    }

    // Cooldown check (last_message_at stored in seconds)
    if (user.last_message_at && nowSec - user.last_message_at < cooldown) return

    // Random XP
    const xpMin = settings.xp_min || 15
    const xpMax = settings.xp_max || 25
    const xpGain = Math.floor(Math.random() * (xpMax - xpMin + 1)) + xpMin

    const oldLevel = user.level
    const newXp = user.xp + xpGain
    const newLevel = levelFromXp(newXp)

    db.upsertUser({
      id: userId,
      guild_id: guildId,
      xp: newXp,
      level: newLevel,
      last_message_at: nowSec,
      username: message.author.username,
      avatar: message.author.avatar,
      nickname: message.member ? message.member.nickname : null,
      global_name: message.author.globalName || null,
    })

    if (newLevel > oldLevel) {
      const member = await message.guild.members.fetch(userId).catch(() => null)
      if (member) {
        await handleLevelUp(client, message.guild, member, newLevel, settings)
      }
    }

    // Capture links from message content
    const urls = message.content.match(URL_REGEX)
    if (urls) {
      const channelName = message.channel?.name || null
      for (const url of urls) {
        db.saveLink({
          guild_id: guildId,
          channel_id: message.channel.id,
          channel_name: channelName,
          user_id: userId,
          url,
          message_id: message.id,
        })
      }
    }

    // Auto-react with tier emoji (~8% chance) to show rank flair in chat
    // Only for users who have a tier (level >= 10) — sparks curiosity for others
    if (newLevel >= 10 && Math.random() < 0.08) {
      const tier = getTierForLevel(newLevel)
      try {
        await message.react(tier.badge)
      } catch (_) {
        // Ignore if emoji isn't available or missing permissions
      }
    }
  },
}
