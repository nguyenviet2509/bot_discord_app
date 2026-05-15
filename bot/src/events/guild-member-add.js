const db = require('../../../shared/db')

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    // Log join event cho analytics
    try {
      db.logMemberEvent(member.guild.id, member.id, 'join')
    } catch (err) {
      console.error('[guildMemberAdd] log fail:', err.message)
    }

    // Gui tin nhan chao mung vao "Channel auto-reply khi len cap"
    try {
      const tpl = db.getWelcomeTemplate(member.guild.id)
      if (!tpl || !tpl.enabled) return

      const settings = db.getSettings(member.guild.id)
      const channelId = settings?.level_up_reply_channel_id
      if (!channelId) {
        console.warn(`[Welcome] Guild ${member.guild.id}: chua cau hinh level_up_reply_channel_id`)
        return
      }

      const channel = member.guild.channels.cache.get(channelId)
        || await member.guild.channels.fetch(channelId).catch(() => null)
      if (!channel) {
        console.warn(`[Welcome] Channel ${channelId} not found`)
        return
      }

      const content = (tpl.message || '')
        .replace(/\{user\}/g, `<@${member.id}>`)
        .replace(/\{username\}/g, member.user.username)
        .replace(/\{server\}/g, member.guild.name)

      await channel.send({
        content,
        allowed_mentions: { users: [member.id] },
      })
    } catch (err) {
      console.error('[Welcome] send fail:', err.message)
    }
  },
}
