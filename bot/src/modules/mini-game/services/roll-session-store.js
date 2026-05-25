// CRUD + state machine cho roll_session / roll_participant.
// Toan bo transition wrap trong SQLite transaction de tranh inconsistent.

const { getDb } = require('../../../../../shared/db')

const STATE = Object.freeze({
  OPEN:      'open',
  ROLLING:   'rolling',
  FINISHED:  'finished',
  CANCELLED: 'cancelled',
})

// Tao session moi (state=open). Insert message_id ngay tu dau (Phase 4 send-before-insert).
// Throw err.code='SQLITE_CONSTRAINT_UNIQUE' neu guild da co session active (partial unique index).
function createSession({ guildId, channelId, messageId, hostId, maxPlayers, expiresAt }) {
  const info = getDb().prepare(`
    INSERT INTO roll_session (guild_id, channel_id, message_id, host_id, max_players, state, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(guildId, channelId, messageId, hostId, maxPlayers, STATE.OPEN, expiresAt)
  return getSession(info.lastInsertRowid)
}

function getSession(sessionId) {
  return getDb().prepare('SELECT * FROM roll_session WHERE id = ?').get(sessionId) || null
}

// Update message_id (vd: sau khi delete msg cu + post msg moi luc finish).
function setMessageId(sessionId, messageId) {
  getDb().prepare('UPDATE roll_session SET message_id = ? WHERE id = ?').run(messageId, sessionId)
}

function getActiveSessionByGuild(guildId) {
  return getDb().prepare(`
    SELECT * FROM roll_session
    WHERE guild_id = ? AND state IN ('open','rolling')
    ORDER BY id DESC LIMIT 1
  `).get(guildId) || null
}

function listActiveSessions() {
  return getDb().prepare(`
    SELECT * FROM roll_session WHERE state IN ('open','rolling')
  `).all()
}

// Atomic try-add: kiem tra not-exists + count < max trong 1 SQL.
// Tra ve true neu insert thanh cong, false neu da join hoac da day.
function tryAddParticipant(sessionId, userId) {
  const info = getDb().prepare(`
    INSERT INTO roll_participant (session_id, user_id, score, joined_at)
    SELECT ?, ?, NULL, unixepoch()
    WHERE NOT EXISTS (SELECT 1 FROM roll_participant WHERE session_id = ? AND user_id = ?)
      AND (SELECT COUNT(*) FROM roll_participant WHERE session_id = ?) <
          (SELECT max_players FROM roll_session WHERE id = ? AND state = 'open')
  `).run(sessionId, userId, sessionId, userId, sessionId, sessionId)
  return info.changes === 1
}

function removeParticipant(sessionId, userId) {
  return getDb()
    .prepare('DELETE FROM roll_participant WHERE session_id = ? AND user_id = ? AND score IS NULL')
    .run(sessionId, userId).changes === 1
}

function isParticipant(sessionId, userId) {
  return !!getDb()
    .prepare('SELECT 1 FROM roll_participant WHERE session_id = ? AND user_id = ?')
    .get(sessionId, userId)
}

// Deterministic order: joined_at ASC, user_id ASC -> dung de bind score sau khi roll.
function listParticipants(sessionId) {
  return getDb().prepare(`
    SELECT user_id, score, joined_at FROM roll_participant
    WHERE session_id = ?
    ORDER BY joined_at ASC, user_id ASC
  `).all(sessionId)
}

function countParticipants(sessionId) {
  return getDb()
    .prepare('SELECT COUNT(*) AS c FROM roll_participant WHERE session_id = ?')
    .get(sessionId).c
}

// Chuyen open -> rolling (race-safe: chi 1 caller thanh cong).
function transitionToRolling(sessionId) {
  const info = getDb()
    .prepare(`UPDATE roll_session SET state = 'rolling' WHERE id = ? AND state = 'open'`)
    .run(sessionId)
  return info.changes === 1
}

// Atomic: transitionToRolling + settleScores trong 1 transaction.
// rollFn(participants) -> int[] score moi participant (cung thu tu).
// Return { participants, scores, winner } neu thanh cong, null neu state != 'open'.
function rollAndSettle(sessionId, rollFn) {
  const db = getDb()
  let result = null
  db.transaction(() => {
    const tr = db.prepare(`UPDATE roll_session SET state = 'rolling' WHERE id = ? AND state = 'open'`).run(sessionId)
    if (tr.changes !== 1) return // state khong open -> bo qua
    const participants = db.prepare(`
      SELECT user_id, score, joined_at FROM roll_participant
      WHERE session_id = ?
      ORDER BY joined_at ASC, user_id ASC
    `).all(sessionId)
    if (participants.length < 2) {
      // Rollback transition: huy luon
      db.prepare(`UPDATE roll_session SET state = 'cancelled', cancel_reason = ?, finished_at = unixepoch() WHERE id = ?`)
        .run('Khong du nguoi (<2)', sessionId)
      result = { cancelled: true, reason: 'Khong du nguoi (<2)' }
      return
    }
    const scores = rollFn(participants.length)
    const upd = db.prepare('UPDATE roll_participant SET score = ? WHERE session_id = ? AND user_id = ?')
    let winnerId = null, winnerScore = -1
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i]
      const s = scores[i]
      upd.run(s, sessionId, p.user_id)
      if (s > winnerScore) { winnerScore = s; winnerId = p.user_id }
      p.score = s
    }
    db.prepare(`
      UPDATE roll_session SET state = 'finished', winner_id = ?, winner_score = ?, finished_at = unixepoch()
      WHERE id = ?
    `).run(winnerId, winnerScore, sessionId)
    participants.sort((a, b) => b.score - a.score)
    result = { participants, scores, winnerId, winnerScore }
  })()
  return result
}

// Cancel chi khi state='open' (tranh ghi de session dang rolling/finished tu race expire timer).
// Return changes (1 neu cancelled, 0 neu state khac).
function cancelSessionIfOpen(sessionId, reason) {
  return getDb().prepare(`
    UPDATE roll_session SET state = 'cancelled', cancel_reason = ?, finished_at = unixepoch()
    WHERE id = ? AND state = 'open'
  `).run(reason, sessionId).changes
}

// Force cancel (cho startup sweep): cancel ca khi state='rolling' (zombie).
function forceCancelSession(sessionId, reason) {
  return getDb().prepare(`
    UPDATE roll_session SET state = 'cancelled', cancel_reason = ?, finished_at = unixepoch()
    WHERE id = ? AND state IN ('open','rolling')
  `).run(reason, sessionId).changes
}

// ===== Dashboard history queries =====

function listHistory({ guildId, from, to, limit, offset }) {
  const where = ['guild_id = ?']
  const params = [guildId]
  if (from) { where.push('created_at >= ?'); params.push(from) }
  if (to)   { where.push('created_at <= ?'); params.push(to) }
  const sql = `
    SELECT id, guild_id, channel_id, host_id, max_players, state,
           winner_id, winner_score, cancel_reason, created_at, finished_at,
           (SELECT COUNT(*) FROM roll_participant WHERE session_id = rs.id) AS participant_count
    FROM roll_session rs
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `
  const rows = getDb().prepare(sql).all(...params, limit, offset)
  const total = getDb().prepare(`SELECT COUNT(*) AS c FROM roll_session WHERE ${where.join(' AND ')}`).get(...params).c
  return { rows, total }
}

function getHistoryDetail(sessionId, guildId) {
  const session = getDb()
    .prepare('SELECT * FROM roll_session WHERE id = ? AND guild_id = ?')
    .get(sessionId, guildId)
  if (!session) return null
  // Portable: (score IS NULL) sort NULL last -> score DESC -> joined_at ASC
  const participants = getDb().prepare(`
    SELECT user_id, score, joined_at FROM roll_participant
    WHERE session_id = ?
    ORDER BY (score IS NULL), score DESC, joined_at ASC
  `).all(sessionId)
  return { session, participants }
}

function deleteOlderThan({ guildId, cutoffSec }) {
  return getDb()
    .prepare('DELETE FROM roll_session WHERE guild_id = ? AND created_at < ?')
    .run(guildId, cutoffSec).changes
}

function deleteAllByGuild(guildId) {
  return getDb()
    .prepare('DELETE FROM roll_session WHERE guild_id = ?')
    .run(guildId).changes
}

module.exports = {
  STATE,
  createSession,
  getSession,
  setMessageId,
  getActiveSessionByGuild,
  listActiveSessions,
  tryAddParticipant,
  removeParticipant,
  isParticipant,
  listParticipants,
  countParticipants,
  transitionToRolling,
  rollAndSettle,
  cancelSessionIfOpen,
  forceCancelSession,
  listHistory,
  getHistoryDetail,
  deleteOlderThan,
  deleteAllByGuild,
}
