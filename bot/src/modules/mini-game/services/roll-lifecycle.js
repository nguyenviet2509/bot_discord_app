// Business logic cho mini-game ROLL: orchestrate store + engine + timeout + renderer.
// Handler/command goi cac onXxx function nay, khong tu access store/db.

const store = require('./roll-session-store')
const engine = require('./roll-engine')
const timeoutMgr = require('./roll-timeout')
const renderer = require('./roll-renderer')

// Helper: fetch channel + message tu session, return null neu fail (message bi xoa, channel mat quyen...).
async function fetchSessionMessage(client, session) {
  if (!session.channel_id || !session.message_id) return null
  try {
    const channel = await client.channels.fetch(session.channel_id)
    if (!channel) return null
    const msg = await channel.messages.fetch(session.message_id)
    return msg
  } catch {
    return null
  }
}

// Re-render embed pending message tu DB state (dung cho debounce callback).
async function rerenderPendingMessage(client, sessionId) {
  const session = store.getSession(sessionId)
  if (!session || session.state !== store.STATE.OPEN) return // stale, skip
  const msg = await fetchSessionMessage(client, session)
  if (!msg) return
  const participants = store.listParticipants(sessionId)
  await msg.edit({
    embeds: [renderer.buildPendingEmbed({ session, participants })],
    components: [renderer.buildPublicButtons(sessionId, false)], // joined state per-user, embed chung dung false
    allowedMentions: { parse: [] },
  }).catch(err => console.warn('[roll:rerender]', err.message))
}

// Strict host check: chi user.id === session.host_id moi qua. Bo admin override.
async function ensureHost(interaction, session) {
  if (interaction.user.id === session.host_id) return true
  await interaction.reply({ content: '🚫 Chỉ host (người tạo session) mới được dùng nút này.', ephemeral: true })
  return false
}

// Toggle join/leave. Defer reply ephemeral de tranh "interaction failed" race voi debounce.
async function onJoin(interaction, sessionId) {
  const session = store.getSession(sessionId)
  if (!session || session.state !== store.STATE.OPEN) {
    return interaction.reply({ content: '⚠️ Session không còn mở.', ephemeral: true })
  }
  const userId = interaction.user.id
  const alreadyJoined = store.isParticipant(sessionId, userId)
  if (alreadyJoined) {
    const removed = store.removeParticipant(sessionId, userId)
    if (removed) {
      await interaction.reply({ content: '🚪 Đã rời khỏi session.', ephemeral: true })
    } else {
      await interaction.reply({ content: '⚠️ Không thể rời (đã roll hoặc lỗi state).', ephemeral: true })
    }
  } else {
    const ok = store.tryAddParticipant(sessionId, userId)
    if (ok) {
      await interaction.reply({ content: `🎯 Đã tham gia ROLL Session #${sessionId}.`, ephemeral: true })
    } else {
      const cnt = store.countParticipants(sessionId)
      await interaction.reply({
        content: `⚠️ Không tham gia được. Có thể đã đủ ${cnt}/${session.max_players} người hoặc session đã đóng.`,
        ephemeral: true,
      })
      return
    }
  }
  // Debounce edit (coalesce nhieu join lien tiep).
  renderer.scheduleEdit(sessionId, () => rerenderPendingMessage(interaction.client, sessionId))
}

async function onCancel(interaction, sessionId) {
  const session = store.getSession(sessionId)
  if (!session) return interaction.reply({ content: 'Session không tồn tại.', ephemeral: true })
  if (session.state !== store.STATE.OPEN) {
    return interaction.reply({ content: `⚠️ Session đang ở state '${session.state}', không hủy được.`, ephemeral: true })
  }
  if (!(await ensureHost(interaction, session))) return
  // Clear timer TRUOC khi cancel (tranh expire fire trong window).
  timeoutMgr.clear(sessionId)
  const changes = store.cancelSessionIfOpen(sessionId, `Hủy bởi <@${interaction.user.id}>`)
  if (changes === 0) {
    return interaction.reply({ content: '⚠️ Session đã chuyển state, không hủy được.', ephemeral: true })
  }
  await interaction.reply({ content: '❌ Đã hủy session.', ephemeral: true })
  await editToCancelled(interaction.client, sessionId, `Hủy bởi <@${interaction.user.id}>`)
  renderer.dropSession(sessionId)
}

async function editToCancelled(client, sessionId, reason) {
  const session = store.getSession(sessionId)
  if (!session) return
  const msg = await fetchSessionMessage(client, session)
  if (!msg) return
  const participants = store.listParticipants(sessionId)
  await renderer.editNow(sessionId, async () => {
    await msg.edit({
      embeds: [renderer.buildCancelEmbed({ session, participants, reason })],
      components: [],
      allowedMentions: { parse: [] },
    })
  })
}

async function onStart(interaction, sessionId) {
  const session = store.getSession(sessionId)
  if (!session) return interaction.reply({ content: 'Session không tồn tại.', ephemeral: true })
  if (session.state !== store.STATE.OPEN) {
    return interaction.reply({ content: `⚠️ Session đang ở state '${session.state}', không start được.`, ephemeral: true })
  }
  if (!(await ensureHost(interaction, session))) return
  const count = store.countParticipants(sessionId)
  if (count < 2) {
    return interaction.reply({ content: `⚠️ Cần ≥ 2 người để bắt đầu (hiện ${count}).`, ephemeral: true })
  }
  // Clear timer TRUOC khi transition (tranh expire race).
  timeoutMgr.clear(sessionId)

  // Atomic: transition + settle scores trong 1 transaction.
  const result = store.rollAndSettle(sessionId, n => engine.rollScores(n))
  if (!result) {
    return interaction.reply({ content: '⚠️ Session đã chuyển state bởi flow khác, thử lại.', ephemeral: true })
  }
  if (result.cancelled) {
    // Het 2 nguoi giua chung (race) -> da auto cancel
    await interaction.reply({ content: '⚠️ Không đủ người sau khi check, đã hủy.', ephemeral: true })
    await editToCancelled(interaction.client, sessionId, result.reason)
    renderer.dropSession(sessionId)
    return
  }

  // Reply ephemeral cho host, render result public.
  await interaction.reply({ content: '🎲 Đang công bố kết quả...', ephemeral: true })
  const ranked = result.participants // store da sort desc
  const finalSession = store.getSession(sessionId)

  // Khi finished: delete message cu + post message moi -> result luon o cuoi channel
  // (chong member chat lam troi). Cancel/expire giu flow cu (edit in-place).
  await renderer.editNow(sessionId, async () => {
    const channel = await interaction.client.channels.fetch(finalSession.channel_id).catch(() => null)
    if (!channel) {
      console.warn(`[roll:repost] Channel ${finalSession.channel_id} khong fetch duoc, skip repost`)
      return
    }
    // 1. Delete message cu (best-effort, fail vi perm/missing -> bo qua)
    if (finalSession.message_id) {
      try {
        const oldMsg = await channel.messages.fetch(finalSession.message_id).catch(() => null)
        if (oldMsg) await oldMsg.delete()
      } catch (err) {
        console.warn('[roll:delete-old]', err.message)
      }
    }
    // 2. Post message moi voi result embed o cuoi channel
    const newMsg = await channel.send({
      embeds: [renderer.buildResultEmbed({ session: finalSession, rankedParticipants: ranked })],
      allowedMentions: { users: [result.winnerId] }, // chi ping winner
    })
    // 3. Update DB de consistency (dashboard detail link, audit)
    store.setMessageId(sessionId, newMsg.id)
  })
  renderer.dropSession(sessionId)
}

// Timer expire fire: cancel khi state='open' (no-op neu state khac).
async function onExpire(client, sessionId) {
  const changes = store.cancelSessionIfOpen(sessionId, 'Hết hạn, host không chốt')
  if (changes === 0) return // da transition sang rolling/finished/cancelled -> skip
  await editToCancelled(client, sessionId, 'Hết hạn, host không chốt')
  renderer.dropSession(sessionId)
}

// Startup sweep: xu ly zombie session sau khi bot restart.
async function sweepOnStartup(client) {
  let sessions = []
  try {
    sessions = store.listActiveSessions()
  } catch (err) {
    console.error('[roll:sweep] Khong query duoc roll_session (schema chua init?):', err.message)
    return
  }
  const now = Math.floor(Date.now() / 1000)
  console.log(`[roll:sweep] Tim thay ${sessions.length} session can xu ly`)

  for (const s of sessions) {
    try {
      // Bot khong con o guild do -> chi DB-cancel, khong fetch channel
      if (!client.guilds.cache.has(s.guild_id)) {
        store.forceCancelSession(s.id, 'Bot khong con o guild')
        console.log(`[roll:sweep] DB-cancel session #${s.id} (guild ${s.guild_id} khong active)`)
        continue
      }
      if (s.state === store.STATE.ROLLING) {
        store.forceCancelSession(s.id, 'Bot restart giữa lúc roll')
        await editAfterSweep(client, s.id, 'Bot restart giữa lúc roll')
      } else if (s.expires_at < now) {
        store.forceCancelSession(s.id, 'Hết hạn khi bot restart')
        await editAfterSweep(client, s.id, 'Hết hạn khi bot restart')
      } else {
        const diffMs = (s.expires_at - now) * 1000
        timeoutMgr.set(s.id, diffMs, () => onExpire(client, s.id))
        console.log(`[roll:sweep] Re-schedule session #${s.id} (${diffMs}ms)`)
      }
    } catch (err) {
      console.error(`[roll:sweep] Loi session #${s.id}:`, err.message)
    }
  }
}

async function editAfterSweep(client, sessionId, reason) {
  const session = store.getSession(sessionId)
  if (!session || !session.message_id) return
  const msg = await fetchSessionMessage(client, session)
  if (!msg) return
  const participants = store.listParticipants(sessionId)
  await msg.edit({
    embeds: [renderer.buildCancelEmbed({ session, participants, reason })],
    components: [],
    allowedMentions: { parse: [] },
  }).catch(err => console.warn(`[roll:sweep] Khong edit duoc message #${sessionId}:`, err.message))
}

module.exports = {
  onJoin,
  onCancel,
  onStart,
  onExpire,
  sweepOnStartup,
}
