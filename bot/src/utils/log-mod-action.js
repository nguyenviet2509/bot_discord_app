const db = require('../../../shared/db')

// Helper chung: log mod action sau khi command thanh cong
function logModAction(interaction, { action_type, user, reason, duration_ms, expires_at }) {
  try {
    db.logModAction({
      guild_id: interaction.guild.id,
      action_type,
      user_id: user.id,
      user_tag: user.tag || user.username || null,
      user_avatar: user.displayAvatarURL ? user.displayAvatarURL({ size: 64 }) : null,
      moderator_id: interaction.user.id,
      moderator_tag: interaction.user.tag || interaction.user.username || null,
      reason: reason || null,
      duration_ms: duration_ms || null,
      expires_at: expires_at || null,
    })
  } catch (err) {
    console.error('[ModLog] Failed to log action:', err.message)
  }
}

module.exports = logModAction
