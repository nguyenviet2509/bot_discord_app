// Route button interaction co customId prefix `mg:roll:` -> roll-lifecycle.
// Format:
//   mg:roll:join:<sessionId>         (public message, validate message.id)
//   mg:roll:host-start:<sessionId>   (ephemeral, skip message.id check)
//   mg:roll:host-cancel:<sessionId>  (ephemeral, skip message.id check)

const lifecycle = require('../services/roll-lifecycle')
const store = require('../services/roll-session-store')

async function handle(interaction) {
  const id = interaction.customId
  if (!id.startsWith('mg:roll:')) return false
  const parts = id.split(':')
  const action = parts[2]
  // Strict parse: chi cho phep digit, chong customId hijack
  if (!/^\d+$/.test(parts[3] || '')) {
    return interaction.reply({ content: 'Session id khong hop le.', ephemeral: true }).then(() => true)
  }
  const sessionId = parseInt(parts[3], 10)

  const session = store.getSession(sessionId)
  if (!session) {
    return interaction.reply({ content: 'Session khong ton tai.', ephemeral: true }).then(() => true)
  }

  // Public action 'join': validate message.id khop voi session (chong hijack tu message khac)
  // Host action: ephemeral message.id KHAC session.message_id -> skip message.id check, chi check channel
  if (action === 'join') {
    if (session.message_id !== interaction.message?.id || session.channel_id !== interaction.channelId) {
      return interaction.reply({ content: '⚠️ Button khong thuoc session nay.', ephemeral: true }).then(() => true)
    }
  } else if (action === 'host-start' || action === 'host-cancel') {
    if (session.channel_id !== interaction.channelId) {
      return interaction.reply({ content: '⚠️ Phai o cung channel voi session.', ephemeral: true }).then(() => true)
    }
  }

  try {
    if (action === 'join')        { await lifecycle.onJoin(interaction, sessionId);   return true }
    if (action === 'host-start')  { await lifecycle.onStart(interaction, sessionId);  return true }
    if (action === 'host-cancel') { await lifecycle.onCancel(interaction, sessionId); return true }
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
