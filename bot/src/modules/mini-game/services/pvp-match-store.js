// CRUD state machine cho pvp_match + escrow coin tx.
// Tat ca thao tac doi state + chuyen coin deu chay trong transaction de tranh inconsistent.

const { getDb } = require('../../../../../shared/db')
const { addCoin } = require('../../../../../shared/db-mini-game')

const STATE = Object.freeze({
  PENDING:   'pending',   // A da challenge, dang cho B accept
  PICKING:   'picking',   // B accepted, ca 2 dang chon nuoc di
  FINISHED:  'finished',
  CANCELLED: 'cancelled',
})

function rowToMatch(row) {
  if (!row) return null
  return { ...row, meta: row.meta ? JSON.parse(row.meta) : null }
}

function getMatchById(id) {
  const row = getDb().prepare('SELECT * FROM pvp_match WHERE id = ?').get(id)
  return rowToMatch(row)
}

// Tao match: trang thai pending. Tru coin cua A ngay (escrow).
function createMatch({ guildId, channelId, game, playerA, playerB, stake, meta }) {
  const db = getDb()
  let matchId
  db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO pvp_match (guild_id, channel_id, game, player_a, player_b, stake, state, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(guildId, channelId, game, playerA, playerB, stake, STATE.PENDING, meta ? JSON.stringify(meta) : null)
    matchId = info.lastInsertRowid
    addCoin(guildId, playerA, -stake, `${game}-pvp:escrow:match${matchId}`)
  })()
  return getMatchById(matchId)
}

// Luu message_id cua embed bot post de edit sau.
function setMessageId(matchId, messageId) {
  getDb().prepare('UPDATE pvp_match SET message_id = ? WHERE id = ?').run(messageId, matchId)
}

// B accept: tru coin B (escrow), chuyen state -> picking.
function acceptMatch(matchId) {
  const db = getDb()
  let result
  db.transaction(() => {
    const m = getMatchById(matchId)
    if (!m || m.state !== STATE.PENDING) {
      throw new Error('Match khong o trang thai pending')
    }
    addCoin(m.guild_id, m.player_b, -m.stake, `${m.game}-pvp:escrow:match${matchId}`)
    db.prepare('UPDATE pvp_match SET state = ? WHERE id = ?').run(STATE.PICKING, matchId)
    result = getMatchById(matchId)
  })()
  return result
}

// Huy match: hoan coin cho nhung ai da escrow (tuy state).
function cancelMatch(matchId, reason) {
  const db = getDb()
  let result
  db.transaction(() => {
    const m = getMatchById(matchId)
    if (!m || m.state === STATE.FINISHED || m.state === STATE.CANCELLED) return
    // Hoan A (luon co escrow tu luc create)
    addCoin(m.guild_id, m.player_a, m.stake, `${m.game}-pvp:refund:match${matchId}:${reason || 'cancel'}`)
    // Hoan B chi khi da accept (state >= picking)
    if (m.state === STATE.PICKING) {
      addCoin(m.guild_id, m.player_b, m.stake, `${m.game}-pvp:refund:match${matchId}:${reason || 'cancel'}`)
    }
    db.prepare('UPDATE pvp_match SET state = ?, finished_at = unixepoch() WHERE id = ?')
      .run(STATE.CANCELLED, matchId)
    result = getMatchById(matchId)
  })()
  return result
}

// Ghi nuoc di cua 1 ben. Khong settle ngay - de caller goi settle khi du.
function recordPick(matchId, userId, pick) {
  const db = getDb()
  const m = getMatchById(matchId)
  if (!m || m.state !== STATE.PICKING) throw new Error('Match khong o trang thai picking')
  const col = userId === m.player_a ? 'pick_a' : userId === m.player_b ? 'pick_b' : null
  if (!col) throw new Error('User khong thuoc match')
  if (m[col]) return getMatchById(matchId) // da pick, bo qua duplicate
  db.prepare(`UPDATE pvp_match SET ${col} = ? WHERE id = ?`).run(pick, matchId)
  return getMatchById(matchId)
}

// Ket thuc match: chuyen coin theo ket qua. winner = userId hoac 'draw'.
function settleMatch(matchId, winnerUserId) {
  const db = getDb()
  let result
  db.transaction(() => {
    const m = getMatchById(matchId)
    if (!m || m.state !== STATE.PICKING) throw new Error('Match chua san sang settle')
    if (winnerUserId === 'draw') {
      // Hoan ca 2 (do A va B deu da escrow)
      addCoin(m.guild_id, m.player_a, m.stake, `${m.game}-pvp:draw:match${matchId}`)
      addCoin(m.guild_id, m.player_b, m.stake, `${m.game}-pvp:draw:match${matchId}`)
    } else {
      // Winner an tron 2 phan escrow (da bi tru 1 phan luc challenge/accept)
      addCoin(m.guild_id, winnerUserId, m.stake * 2, `${m.game}-pvp:win:match${matchId}`)
    }
    db.prepare('UPDATE pvp_match SET state = ?, winner = ?, finished_at = unixepoch() WHERE id = ?')
      .run(STATE.FINISHED, winnerUserId, matchId)
    result = getMatchById(matchId)
  })()
  return result
}

// Tim match active (pending/picking) cua user lam A hoac B - chong spam.
function getActiveMatchByUser(guildId, userId) {
  const row = getDb().prepare(`
    SELECT * FROM pvp_match
    WHERE guild_id = ? AND state IN ('pending','picking') AND (player_a = ? OR player_b = ?)
    ORDER BY id DESC LIMIT 1
  `).get(guildId, userId, userId)
  return rowToMatch(row)
}

module.exports = {
  STATE,
  createMatch,
  setMessageId,
  acceptMatch,
  cancelMatch,
  recordPick,
  settleMatch,
  getMatchById,
  getActiveMatchByUser,
}
