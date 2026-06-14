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
      if (ch) await safeSend(notifyChannel, cfg, 'leave', member, ch)
    }
    if (newCh && watched.includes(newCh)) {
      const ch = newState.channel || await guild.channels.fetch(newCh).catch(() => null)
      if (ch) await safeSend(notifyChannel, cfg, 'join', member, ch)
    }
  },
}

function renderTemplate(template, member, channel) {
  const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
  return String(template || '')
    .replace(/\{user\}/g, `<@${member.id}>`)
    .replace(/\{username\}/g, member.displayName || member.user.username)
    .replace(/\{channel\}/g, channel.name)
    .replace(/\{time\}/g, time)
}

function hexToInt(hex, fallback) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(String(hex || ''))
  return m ? parseInt(m[1], 16) : fallback
}

async function safeSend(notifyChannel, cfg, eventType, member, channel) {
  try {
    const template = eventType === 'join' ? cfg.join_template : cfg.leave_template
    const description = renderTemplate(template, member, channel)
    if (!description.trim()) return

    const allowedMentions = { users: [member.id] }

    if (cfg.use_embed) {
      const isJoin = eventType === 'join'
      const colorHex = isJoin ? cfg.embed_color_join : cfg.embed_color_leave
      const color = hexToInt(colorHex, isJoin ? 0x22c55e : 0xef4444)
      const embed = { color, description }
      if (cfg.show_author) {
        embed.author = {
          name: member.displayName || member.user.username,
          icon_url: member.displayAvatarURL ? member.displayAvatarURL() : member.user.displayAvatarURL(),
        }
      }
      if (cfg.show_footer) {
        const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        embed.footer = { text: `${channel.name} • ${time}` }
      }
      await notifyChannel.send({ embeds: [embed], allowedMentions })
    } else {
      await notifyChannel.send({ content: description, allowedMentions })
    }
  } catch (err) {
    console.error('[VoiceLog] send fail:', err.message)
  }
}
