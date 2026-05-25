// Route button interaction co customId prefix `mg:roll:` -> roll-lifecycle.
// Format:
//   mg:roll:join:<sessionId>
//   mg:roll:start:<sessionId>
//   mg:roll:cancel:<sessionId>

const lifecycle = require('../services/roll-lifecycle')
const store = require('../services/roll-session-store')

async function handle(interaction) {
  const id = interaction.customId
  if (!id.startsWith('mg:roll:')) return false
  const parts = id.split(':')
  const action = parts[2]
  // Strict parse: chi cho phep digit, chong customId hijack/replay
  if (!/^\d+$/.test(parts[3] || '')) {
    return interaction.reply({ content: 'Session id khong hop le.', ephemeral: true }).then(() => true)
  }
  const sessionId = parseInt(parts[3], 10)

  // Validate session + interaction message khop -> chong hijack tu message khac
  const session = store.getSession(sessionId)
  if (!session) {
    return interaction.reply({ content: 'Session khong ton tai.', ephemeral: true }).then(() => true)
  }
  if (session.message_id !== interaction.message?.id || session.channel_id !== interaction.channelId) {
    return interaction.reply({ content: '⚠️ Button khong thuoc session nay.', ephemeral: true }).then(() => true)
  }

  try {
    if (action === 'join')   { await lifecycle.onJoin(interaction, sessionId);   return true }
    if (action === 'start')  { await lifecycle.onStart(interaction, sessionId);  return true }
    if (action === 'cancel') { await lifecycle.onCancel(interaction, sessionId); return true }
  } catch (err) {
    console.error('[mg:roll:button]', err)
    const msg = { content: '❌ Loi xu ly nut bam.', ephemeral: true }
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {})
    else await interaction.reply(msg).catch(() => {})
    return true
  }
  return false
}

module.exports = { handle }
