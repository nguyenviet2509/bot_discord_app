// DB schema + helpers cho feature Voice Statistics (leaderboard thoi gian voice).
// Dung chung SQLite connection voi shared/db.js (lay qua getDb()).
//
// Bang:
//   - voice_sessions: moi session join->leave 1 row (raw events)
// Cot voice_stats_enabled them vao voice_log_settings de toggle rieng.
//
// Cap duration: SUM lay MIN(duration_sec, 86400) de chong AFK 24h+ inflate data.

const MAX_SESSION_SEC = 86400 // 24h cap chong AFK

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS voice_sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    channel_id    TEXT NOT NULL,
    joined_at     INTEGER NOT NULL,
    left_at       INTEGER,
    duration_sec  INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_vs_guild_user_time
    ON voice_sessions(guild_id, user_id, joined_at);

  CREATE INDEX IF NOT EXISTS idx_vs_guild_time
    ON voice_sessions(guild_id, joined_at);

  CREATE INDEX IF NOT EXISTS idx_vs_active
    ON voice_sessions(guild_id, user_id) WHERE left_at IS NULL;
`

function initVoiceStatsSchema(database) {
  database.exec(SCHEMA_SQL)
  // Migration: them cot voice_stats_enabled vao voice_log_settings (default ON).
  // SQLite khong ho tro ADD COLUMN IF NOT EXISTS, dung try/catch.
  try {
    database.exec(`ALTER TABLE voice_log_settings ADD COLUMN voice_stats_enabled INTEGER NOT NULL DEFAULT 1`)
  } catch (_) { /* da ton tai */ }
}

// Lazy resolver de tranh circular require voi db.js
function db() {
  return require('./db').getDb()
}

// ============================================================
// Tracking helpers

// Mo session moi (user vua join watched channel). Tra ve session id.
function openSession(guildId, userId, channelId, joinedAt) {
  const r = db()
    .prepare(`
      INSERT INTO voice_sessions (guild_id, user_id, channel_id, joined_at)
      VALUES (?, ?, ?, ?)
    `)
    .run(guildId, userId, channelId, joinedAt)
  return r.lastInsertRowid
}

// Dong tat ca session dang active cua 1 user trong 1 guild (set left_at + duration).
// Goi khi user roi watched channel hoac switch sang channel khac.
function closeActiveSessions(guildId, userId, leftAt) {
  return db()
    .prepare(`
      UPDATE voice_sessions
      SET left_at = ?, duration_sec = MAX(0, ? - joined_at)
      WHERE guild_id = ? AND user_id = ? AND left_at IS NULL
    `)
    .run(leftAt, leftAt, guildId, userId)
}

// Dong tat ca orphan session leftover tu lan chay truoc (bot crash/restart).
// Set left_at = joined_at, duration = 0 (acceptable loss, tranh inflate).
function closeAllOrphans() {
  return db()
    .prepare(`
      UPDATE voice_sessions
      SET left_at = joined_at, duration_sec = 0
      WHERE left_at IS NULL
    `)
    .run()
}

function hasActiveSession(guildId, userId) {
  const row = db()
    .prepare(`
      SELECT 1 FROM voice_sessions
      WHERE guild_id = ? AND user_id = ? AND left_at IS NULL
      LIMIT 1
    `)
    .get(guildId, userId)
  return !!row
}

// ============================================================
// Settings (voice_stats_enabled column tren voice_log_settings)

function isVoiceStatsEnabled(guildId) {
  const row = db()
    .prepare('SELECT voice_stats_enabled FROM voice_log_settings WHERE guild_id = ?')
    .get(guildId)
  if (!row) return true // default ON khi chua co config
  return !!row.voice_stats_enabled
}

function setVoiceStatsEnabled(guildId, enabled) {
  const flag = enabled ? 1 : 0
  // Neu row chua ton tai → tao moi voi default + flag
  const existing = db()
    .prepare('SELECT guild_id FROM voice_log_settings WHERE guild_id = ?')
    .get(guildId)
  if (existing) {
    return db()
      .prepare('UPDATE voice_log_settings SET voice_stats_enabled = ?, updated_at = unixepoch() WHERE guild_id = ?')
      .run(flag, guildId)
  }
  return db()
    .prepare(`
      INSERT INTO voice_log_settings (guild_id, enabled, voice_stats_enabled)
      VALUES (?, 0, ?)
    `)
    .run(guildId, flag)
}

// ============================================================
// Query helpers (leaderboard, user stats)

// Tra ve leaderboard top N user theo tong duration trong [fromTs, toTs).
// Capping duration o MIN(duration, 86400) chong AFK 24h inflate.
// Session dang active (left_at IS NULL) duoc tinh bang (now - joined_at) → real-time.
function getLeaderboard(guildId, fromTs, toTs, limit = 10) {
  const now = Math.floor(Date.now() / 1000)
  return db()
    .prepare(`
      SELECT
        user_id,
        SUM(MIN(COALESCE(duration_sec, ? - joined_at), ?)) AS total_sec,
        COUNT(*) AS join_count
      FROM voice_sessions
      WHERE guild_id = ?
        AND joined_at >= ?
        AND joined_at < ?
      GROUP BY user_id
      ORDER BY total_sec DESC
      LIMIT ?
    `)
    .all(now, MAX_SESSION_SEC, guildId, fromTs, toTs, limit)
}

// Stats ca nhan 1 user trong range. Tra ve null neu khong co data.
// Active session tinh nhu (now - joined_at) de hien thi real-time.
function getUserStats(guildId, userId, fromTs, toTs) {
  const now = Math.floor(Date.now() / 1000)
  const row = db()
    .prepare(`
      SELECT
        SUM(MIN(COALESCE(duration_sec, ? - joined_at), ?)) AS total_sec,
        COUNT(*) AS join_count
      FROM voice_sessions
      WHERE guild_id = ?
        AND user_id = ?
        AND joined_at >= ?
        AND joined_at < ?
    `)
    .get(now, MAX_SESSION_SEC, guildId, userId, fromTs, toTs)
  if (!row || !row.join_count) return null

  const rankRow = db()
    .prepare(`
      SELECT COUNT(*) AS higher FROM (
        SELECT user_id, SUM(MIN(COALESCE(duration_sec, ? - joined_at), ?)) AS total_sec
        FROM voice_sessions
        WHERE guild_id = ?
          AND joined_at >= ?
          AND joined_at < ?
        GROUP BY user_id
        HAVING total_sec > ?
      )
    `)
    .get(now, MAX_SESSION_SEC, guildId, fromTs, toTs, row.total_sec || 0)
  const totalRow = db()
    .prepare(`
      SELECT COUNT(DISTINCT user_id) AS total FROM voice_sessions
      WHERE guild_id = ? AND joined_at >= ? AND joined_at < ?
    `)
    .get(guildId, fromTs, toTs)

  return {
    total_sec: row.total_sec || 0,
    join_count: row.join_count || 0,
    rank: (rankRow?.higher || 0) + 1,
    total_members: totalRow?.total || 0,
  }
}

// Channel ua thich (channel co tong duration cao nhat) cua 1 user trong range.
function getTopChannelForUser(guildId, userId, fromTs, toTs) {
  const now = Math.floor(Date.now() / 1000)
  return db()
    .prepare(`
      SELECT
        channel_id,
        SUM(MIN(COALESCE(duration_sec, ? - joined_at), ?)) AS total_sec
      FROM voice_sessions
      WHERE guild_id = ?
        AND user_id = ?
        AND joined_at >= ?
        AND joined_at < ?
      GROUP BY channel_id
      ORDER BY total_sec DESC
      LIMIT 1
    `)
    .get(now, MAX_SESSION_SEC, guildId, userId, fromTs, toTs)
}

module.exports = {
  initVoiceStatsSchema,
  openSession,
  closeActiveSessions,
  closeAllOrphans,
  hasActiveSession,
  isVoiceStatsEnabled,
  setVoiceStatsEnabled,
  getLeaderboard,
  getUserStats,
  getTopChannelForUser,
  MAX_SESSION_SEC,
}
