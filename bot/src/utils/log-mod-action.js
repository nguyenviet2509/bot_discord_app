const db = require('../../../shared/db')

// Lay ten hien thi: uu tien nickname trong server > global name > username > tag
function resolveDisplayName(guild, user) {
  if (!user) return null
  try {
    const member = guild?.members?.cache?.get(user.id)
    if (member?.nickname) return member.nickname
    if (member?.displayName) return member.displayName
  } catch (_) {}
  return user.globalName || user.username || user.tag || null
}

// Helper chung: log mod action sau khi command thanh cong
function logModAction(interaction, { action_type, user, reason, duration_ms, expires_at }) {
  try {
    db.logModAction({
      guild_id: interaction.guild.id,
      action_type,
      user_id: user.id,
      user_tag: resolveDisplayName(interaction.guild, user),
      user_avatar: user.displayAvatarURL ? user.displayAvatarURL({ size: 64 }) : null,
      moderator_id: interaction.user.id,
      moderator_tag: resolveDisplayName(interaction.guild, interaction.user) || interaction.member?.displayName || null,
      reason: reason || null,
      duration_ms: duration_ms || null,
      expires_at: expires_at || null,
    })
  } catch (err) {
    console.error('[ModLog] Failed to log action:', err.message)
  }
}

module.exports = logModAction
