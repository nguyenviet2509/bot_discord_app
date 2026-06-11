// License notification helpers: DM delivery + audit channel embeds.
// Used by bot/commands/license.js and the event poller in bot/src/index.js.

const { EmbedBuilder } = require('discord.js')

// ---- DM helpers ----

// Send license token DM to a Discord user.
// Returns { ok: true } or { ok: false, error: string }
async function sendTokenDM(client, userId, { token, machine_id_short, expires_at, label }) {
  try {
    const user = await client.users.fetch(userId)
    const expStr = expires_at
      ? new Date(expires_at * 1000).toLocaleDateString('vi-VN')
      : 'Vĩnh viễn'
    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle('🔐 WindowHelper License')
      .setDescription(
        `Mã kích hoạt:\n\`\`\`${token}\`\`\`\n\n` +
        `📋 **Cách dùng:**\n1. Mở WindowHelper.exe\n2. Nhập mã vào ô Enter code\n3. Bấm Activate`
      )
      .addFields(
        { name: 'Label', value: label || '—', inline: true },
        { name: 'Machine ID', value: `\`${machine_id_short}\``, inline: true },
        { name: 'Hết hạn', value: expStr, inline: true },
      )
      .setFooter({ text: '⚠️ Không chia sẻ. Mã chỉ dùng được trên máy có Machine ID khớp.' })
    await user.send({ embeds: [embed] })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// DM user when their license is revoked
async function sendRevokedDM(client, userId, reason) {
  try {
    const user = await client.users.fetch(userId)
    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('🚫 License bị thu hồi')
      .setDescription('License WindowHelper của bạn đã bị admin thu hồi.')
      .addFields(
        { name: 'Lý do', value: reason || 'Không có lý do cụ thể' },
      )
      .setFooter({ text: 'Liên hệ admin nếu bạn cho rằng đây là nhầm lẫn.' })
    await user.send({ embeds: [embed] })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// DM user when their machine binding is reset (they can re-activate on a new machine)
async function sendResetDM(client, userId) {
  try {
    const user = await client.users.fetch(userId)
    const embed = new EmbedBuilder()
      .setColor(0xeab308)
      .setTitle('🔄 Machine ID đã được reset')
      .setDescription(
        'Admin đã xoá liên kết máy tính của license bạn.\n' +
        'Bạn có thể dùng lại token cũ trên máy tính mới: mở WindowHelper.exe và nhập lại mã kích hoạt.'
      )
      .setFooter({ text: 'Token không thay đổi. Chỉ machine binding bị xoá.' })
    await user.send({ embeds: [embed] })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// ---- Audit log helper ----

const COLOR_MAP = {
  issue: 0x22c55e,
  activate: 0x22c55e,
  revoke: 0xeab308,
  reset: 0xeab308,
  reject: 0xef4444,
  expired: 0xef4444,
  'expired-attempt': 0xef4444,
  'verify-reject': 0xef4444,
}

// Post an audit embed to the configured audit channel.
// event = { type, user_id?, by?, token_mask?, machine_short?, label?, reason?, ip?, expires_at?, dm_ok? }
async function logAuditEvent(client, channelId, event) {
  if (!channelId) return
  try {
    const ch = await client.channels.fetch(channelId)
    const embed = new EmbedBuilder()
      .setColor(COLOR_MAP[event.type] || 0x64748b)
      .setTitle(`📜 License ${event.type}`)
      .setTimestamp()

    if (event.user_id) embed.addFields({ name: 'User', value: `<@${event.user_id}>`, inline: true })
    if (event.by)      embed.addFields({ name: 'By',   value: `<@${event.by}>`,      inline: true })
    if (event.token_mask)  embed.addFields({ name: 'Token',   value: `\`${event.token_mask}\``,  inline: true })
    if (event.machine_short) embed.addFields({ name: 'Machine', value: `\`${event.machine_short}\``, inline: true })
    if (event.label)   embed.addFields({ name: 'Label',  value: event.label,  inline: true })
    if (event.reason)  embed.addFields({ name: 'Reason', value: event.reason })
    if (event.ip)      embed.addFields({ name: 'IP',     value: event.ip,     inline: true })
    if (event.expires_at) {
      const expStr = new Date(event.expires_at * 1000).toLocaleDateString('vi-VN')
      embed.addFields({ name: 'Hết hạn', value: expStr, inline: true })
    }
    if (event.dm_ok === false) {
      embed.addFields({ name: '⚠️ DM', value: 'DM thất bại — admin cần forward thủ công' })
    }

    await ch.send({ embeds: [embed] })
    return { ok: true }
  } catch (err) {
    // Audit channel errors must not break main flow — but return error so poller can retry
    return { ok: false, error: err.message }
  }
}

module.exports = { sendTokenDM, sendRevokedDM, sendResetDM, logAuditEvent }
