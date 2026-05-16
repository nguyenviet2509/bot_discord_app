const db = require('../../../shared/db')
const { resolveImage } = require('../../../shared/build-scheduled-payload')

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

      // Đính kèm ảnh (nếu có): local file → attachment, URL tuyệt đối → embed.image.url
      const { url: imgUrl, filePath, filename } = resolveImage(tpl.image_url)
      const sendOpts = {
        content,
        allowedMentions: { users: [member.id] },
      }
      if (imgUrl) sendOpts.embeds = [{ image: { url: imgUrl } }]
      if (filePath) sendOpts.files = [{ attachment: filePath, name: filename }]

      await channel.send(sendOpts)
    } catch (err) {
      console.error('[Welcome] send fail:', err.message)
    }
  },
}
