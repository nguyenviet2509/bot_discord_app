const db = require('../../../shared/db')

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const member = newState.member || oldState.member
    if (!member || member.user.bot) return
    const oldCh = oldState.channelId
    const newCh = newState.channelId
    if (oldCh === newCh) return // mute/deafen/stream → bo qua

    const guild = newState.guild || oldState.guild
    if (!guild) return

    const cfg = db.getVoiceLogSettings(guild.id)
    if (!cfg.enabled || !cfg.notify_channel_id) return

    const notifyChannel = guild.channels.cache.get(cfg.notify_channel_id)
      || await guild.channels.fetch(cfg.notify_channel_id).catch(() => null)
    if (!notifyChannel) {
      console.warn(`[VoiceLog] notify channel ${cfg.notify_channel_id} not found`)
      return
    }

    const watched = cfg.watched_channels || []

    if (oldCh && watched.includes(oldCh)) {
      const ch = oldState.channel || await guild.channels.fetch(oldCh).catch(() => null)
      if (ch) await safeSend(notifyChannel, cfg.leave_template, member, ch)
    }
    if (newCh && watched.includes(newCh)) {
      const ch = newState.channel || await guild.channels.fetch(newCh).catch(() => null)
      if (ch) await safeSend(notifyChannel, cfg.join_template, member, ch)
    }
  },
}

async function safeSend(notifyChannel, template, member, channel) {
  try {
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
    const content = String(template || '')
      .replace(/\{user\}/g, `<@${member.id}>`)
      .replace(/\{username\}/g, member.displayName || member.user.username)
      .replace(/\{channel\}/g, channel.name)
      .replace(/\{time\}/g, time)
    if (!content.trim()) return
    await notifyChannel.send({ content, allowedMentions: { users: [member.id] } })
  } catch (err) {
    console.error('[VoiceLog] send fail:', err.message)
  }
}
