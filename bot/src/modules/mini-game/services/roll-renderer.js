// Build embed + button cho mini-game ROLL.
// Co debounce edit 1s coalesce + editNow bypass cho state change.

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')

const COLOR = { wait: 0x6366f1, win: 0x22c55e, cancel: 0x4e5058 }
const DEBOUNCE_MS = 1000
const MAX_DISPLAY = 30 // truncate list khi vuot (chong vuot field/description limit)

// Map<sessionId, Timeout> debounce pending edit
const editTimers = new Map()

function renderParticipantList(participants) {
  if (!participants.length) return '_Chua co ai tham gia_'
  const shown = participants.slice(0, MAX_DISPLAY)
    .map((p, i) => `${i + 1}. <@${p.user_id}>`).join('\n')
  const rest = participants.length - MAX_DISPLAY
  return rest > 0 ? `${shown}\n_... va ${rest} nguoi khac_` : shown
}

function buildPendingEmbed({ session, participants }) {
  return new EmbedBuilder()
    .setColor(COLOR.wait)
    .setTitle(`🎲 ROLL Session #${session.id}`)
    .setDescription([
      `Host: <@${session.host_id}>`,
      `⏱ Hết hạn: <t:${session.expires_at}:R>`,
      ``,
      `**👥 Tham gia (${participants.length}/${session.max_players})**`,
      renderParticipantList(participants),
    ].join('\n'))
    .setFooter({ text: `Pool điểm: 1-100 · Không trùng · Cần ≥ 2 người để bắt đầu` })
}

// Public buttons: 1 nut toggle Tham gia/Roi khoi cho moi member
function buildPublicButtons(sessionId, joined) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mg:roll:join:${sessionId}`)
      .setLabel(joined ? 'Rời khỏi' : 'Tham gia')
      .setEmoji(joined ? '🚪' : '🎯')
      .setStyle(joined ? ButtonStyle.Secondary : ButtonStyle.Primary),
  )
}

// Host-only buttons: gui qua ephemeral, chi host thay/dung duoc
function buildHostButtons(sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mg:roll:host-start:${sessionId}`)
      .setLabel('Bắt đầu roll')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`mg:roll:host-cancel:${sessionId}`)
      .setLabel('Hủy session')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
  )
}

function renderRankingList(rankedParticipants) {
  const medals = ['🥇', '🥈', '🥉']
  const shown = rankedParticipants.slice(0, MAX_DISPLAY).map((p, i) => {
    const prefix = medals[i] ?? `${i + 1}.`
    return `${prefix} <@${p.user_id}> — **${p.score}**`
  }).join('\n')
  const rest = rankedParticipants.length - MAX_DISPLAY
  return rest > 0 ? `${shown}\n_... và ${rest} người khác_` : shown
}

function buildResultEmbed({ session, rankedParticipants }) {
  const winner = rankedParticipants[0]
  return new EmbedBuilder()
    .setColor(COLOR.win)
    .setTitle(`🏆 ROLL Session #${session.id} — Vinh danh`)
    .setDescription([
      `👑 Winner: <@${winner.user_id}> • 💯 **${winner.score} điểm**`,
      ``,
      `**📊 Bảng xếp hạng**`,
      renderRankingList(rankedParticipants),
    ].join('\n'))
    .setFooter({ text: `Đã hoàn tất • ${rankedParticipants.length} người tham gia` })
}

function buildCancelEmbed({ session, participants, reason }) {
  return new EmbedBuilder()
    .setColor(COLOR.cancel)
    .setTitle(`❌ ROLL Session #${session.id} — Hủy`)
    .setDescription(reason || 'Khong ro ly do')
    .setFooter({ text: `${participants.length} người đã đăng ký` })
}

// Schedule edit voi debounce 1s. editFn nhan callback async, callback se re-check state
// (caller chiu trach nhiem) -> stale debounce sau state change se short-circuit.
function scheduleEdit(sessionId, editFn) {
  if (editTimers.has(sessionId)) clearTimeout(editTimers.get(sessionId))
  editTimers.set(sessionId, setTimeout(async () => {
    editTimers.delete(sessionId)
    try { await editFn() } catch (err) { console.error('[roll:edit]', err) }
  }, DEBOUNCE_MS))
}

// Bypass debounce: clear pending timer + edit ngay. Dung cho state change (start/cancel).
async function editNow(sessionId, editFn) {
  if (editTimers.has(sessionId)) {
    clearTimeout(editTimers.get(sessionId))
    editTimers.delete(sessionId)
  }
  try { await editFn() } catch (err) { console.error('[roll:editNow]', err) }
}

// Drop pending timer khi session ket thuc (chong leak Map dai han).
function dropSession(sessionId) {
  if (editTimers.has(sessionId)) {
    clearTimeout(editTimers.get(sessionId))
    editTimers.delete(sessionId)
  }
}

module.exports = {
  buildPendingEmbed,
  buildPublicButtons,
  buildHostButtons,
  buildResultEmbed,
  buildCancelEmbed,
  scheduleEdit,
  editNow,
  dropSession,
}
