// Route button interaction co customId prefix `mg:rps:` -> lifecycle handler.
// Format customId:
//   mg:rps:accept:<matchId>
//   mg:rps:decline:<matchId>
//   mg:rps:pick:<matchId>:<pick>

const lifecycle = require('../services/rps-lifecycle')

async function handle(interaction) {
  const id = interaction.customId
  if (!id.startsWith('mg:rps:')) return false
  const parts = id.split(':')
  const action = parts[2]
  const matchId = parseInt(parts[3], 10)
  if (!matchId) return interaction.reply({ content: 'Match id không hợp lệ.', ephemeral: true }).then(() => true)

  try {
    if (action === 'accept')    { await lifecycle.onAccept(interaction, matchId);  return true }
    if (action === 'decline')   { await lifecycle.onDecline(interaction, matchId); return true }
    if (action === 'open-pick') { await lifecycle.onOpenPick(interaction, matchId); return true }
    if (action === 'pick')      { await lifecycle.onPick(interaction, matchId, parts[4]); return true }
  } catch (err) {
    console.error('[mg:rps:button]', err)
    const msg = { content: '❌ Lỗi xử lý nút bấm.', ephemeral: true }
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {})
    else await interaction.reply(msg).catch(() => {})
    return true
  }
  return false
}

module.exports = { handle }
