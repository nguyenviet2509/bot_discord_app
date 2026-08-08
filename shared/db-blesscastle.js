// DB schema + helpers cho feature BlessCastle Management.
// Dung chung SQLite connection voi shared/db.js (lay qua getDb()).
//
// Bang:
//   - blesscastle_config: config per-guild (voice channels, min minutes, khung gio)
//   - blesscastle_stars: sao tich luy per user (soft-delete co deleted_at)
//   - blesscastle_attendance: track tuan (voice_seconds + attended_manual)
//   - blesscastle_redemptions: log lich su doi qua
//
// Timezone: moi tinh toan week_key dung Asia/Saigon (UTC+7).

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000 // Asia/Saigon offset

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS blesscastle_config (
    guild_id            TEXT PRIMARY KEY,
    voice_channel_ids   TEXT NOT NULL DEFAULT '[]',
    min_minutes         INTEGER NOT NULL DEFAULT 30,
    session_start_hour  INTEGER NOT NULL DEFAULT 20,
    session_end_hour    INTEGER NOT NULL DEFAULT 21,
    enabled             INTEGER NOT NULL DEFAULT 0,
    updated_at          INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS blesscastle_stars (
    guild_id      TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    stars         INTEGER NOT NULL DEFAULT 0,
    last_updated  INTEGER,
    deleted_at    INTEGER,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_bc_stars_active
    ON blesscastle_stars(guild_id, stars DESC);

  CREATE TABLE IF NOT EXISTS blesscastle_attendance (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id          TEXT NOT NULL,
    user_id           TEXT NOT NULL,
    week_key          TEXT NOT NULL,
    voice_seconds     INTEGER NOT NULL DEFAULT 0,
    attended_manual   INTEGER NOT NULL DEFAULT 0,
    finalized         INTEGER NOT NULL DEFAULT 0,
    updated_at        INTEGER DEFAULT (unixepoch()),
    UNIQUE(guild_id, user_id, week_key)
  );

  CREATE INDEX IF NOT EXISTS idx_bc_att_week
    ON blesscastle_attendance(guild_id, week_key);

  CREATE TABLE IF NOT EXISTS blesscastle_redemptions (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id              TEXT NOT NULL,
    user_id               TEXT NOT NULL,
    admin_id              TEXT NOT NULL,
    redeemed_at           INTEGER NOT NULL,
    stars_at_redemption   INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_bc_redemp
    ON blesscastle_redemptions(guild_id, redeemed_at DESC);
`

const DEFAULT_ANNOUNCE_MESSAGE = `📢 **THÔNG BÁO GHI NHẬN THAM GIA BLESSCASTLE TUẦN {week_date}** @everyone

Hí anh em, đây là dữ liệu hệ thống ghi nhận tự động trong buổi BC ngày {week_date}. Nếu có thiếu sót thành viên nào có tham gia mà chưa được ghi nhận thì hãy nhanh tay liên hệ với BQT Clan để được hỗ trợ. Hạn chót tới 20:00 ngày {deadline_date}.

Vì hệ thống mới được phát triển và hoạt động thực tế, nếu có thiếu sót mong anh em thông cảm. Xin cảm ơn anh em đã tin tưởng và tham gia cùng Clan 💖`

function initBlessCastleSchema(database) {
  database.exec(SCHEMA_SQL)
  // Migration: them cot announce_channel_id + announce_message
  try { database.exec(`ALTER TABLE blesscastle_config ADD COLUMN announce_channel_id TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE blesscastle_config ADD COLUMN announce_message TEXT`) } catch (_) {}
}

function db() {
  return require('./db').getDb()
}

// ============================================================
// Time helpers (Asia/Saigon)

// Tra ve Date "hien tai" da shift sang gio Saigon (UTC+7).
// Dung .getUTC* methods de doc year/month/day/hour Saigon.
function saigonDate(ms = Date.now()) {
  return new Date(ms + TZ_OFFSET_MS)
}

// ISO week key YYYY-WW theo gio Saigon.
// Tuan bat dau thu 2 (ISO). Fri 21h thuoc week co Fri do.
function currentWeekKey(ms = Date.now()) {
  return isoWeekKey(saigonDate(ms))
}

// Tra ve weekKey "active" cho guild: neu admin da chot tuan ISO hien tai
// thi advance sang tuan ke tiep (tuan chot roi bi coi la 'da qua', read-only).
function activeWeekKey(guildId, ms = Date.now()) {
  const iso = currentWeekKey(ms)
  const closed = getClosedWeek(guildId)
  if (closed && closed >= iso) {
    // Advance sang tuan ke tiep sau tuan da chot
    return currentWeekKey(ms + 7 * 86400 * 1000)
  }
  return iso
}

function getClosedWeek(guildId) {
  try {
    const row = db().prepare('SELECT value FROM bot_meta WHERE key = ?').get(`bc_closed_week:${guildId}`)
    return row ? row.value : null
  } catch (_) { return null }
}

function setClosedWeek(guildId, weekKey) {
  db().exec(`CREATE TABLE IF NOT EXISTS bot_meta (key TEXT PRIMARY KEY, value TEXT)`)
  db().prepare('INSERT OR REPLACE INTO bot_meta (key, value) VALUES (?, ?)').run(`bc_closed_week:${guildId}`, weekKey)
}

function isoWeekKey(d) {
  // d duoc coi la Date "local Saigon" (getUTC* tra gia tri Saigon)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth()
  const day = d.getUTCDate()
  const tmp = new Date(Date.UTC(year, month, day))
  const dayOfWeek = tmp.getUTCDay() || 7 // Sun=7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7)
  return `${tmp.getUTCFullYear()}-${String(weekNum).padStart(2, '0')}`
}

// Kiem tra thoi diem hien tai co trong khoang "T2 00:00 -> T6 19:00" Saigon khong.
// Dung cho manual tick validation.
function isInManualWindow(ms = Date.now()) {
  if (process.env.BLESSCASTLE_TEST_MODE === '1') return true
  const d = saigonDate(ms)
  const dow = d.getUTCDay() || 7 // Mon=1..Sun=7
  const hour = d.getUTCHours()
  if (dow < 1 || dow > 5) return false
  if (dow === 5 && hour >= 19) return false
  return true
}

// ============================================================
// Config

const _configCache = new Map() // guild_id -> {config, expiresAt}
const CONFIG_TTL_MS = 5000

function getConfig(guildId) {
  const cached = _configCache.get(guildId)
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.config

  const row = db()
    .prepare('SELECT * FROM blesscastle_config WHERE guild_id = ?')
    .get(guildId)
  const cfg = row ? {
    guildId,
    voiceChannelIds: safeParseArray(row.voice_channel_ids),
    minMinutes: row.min_minutes,
    sessionStartHour: row.session_start_hour,
    sessionEndHour: row.session_end_hour,
    enabled: !!row.enabled,
    announceChannelId: row.announce_channel_id || null,
    announceMessage: row.announce_message || DEFAULT_ANNOUNCE_MESSAGE,
  } : {
    guildId,
    voiceChannelIds: [],
    minMinutes: 30,
    sessionStartHour: 20,
    sessionEndHour: 21,
    enabled: false,
    announceChannelId: null,
    announceMessage: DEFAULT_ANNOUNCE_MESSAGE,
  }
  _configCache.set(guildId, { config: cfg, expiresAt: now + CONFIG_TTL_MS })
  return cfg
}

function safeParseArray(s) {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] }
  catch (_) { return [] }
}

function upsertConfig(guildId, patch) {
  const cur = getConfig(guildId)
  const next = {
    voiceChannelIds: patch.voiceChannelIds ?? cur.voiceChannelIds,
    minMinutes: patch.minMinutes ?? cur.minMinutes,
    sessionStartHour: patch.sessionStartHour ?? cur.sessionStartHour,
    sessionEndHour: patch.sessionEndHour ?? cur.sessionEndHour,
    enabled: patch.enabled ?? cur.enabled,
    announceChannelId: patch.announceChannelId !== undefined ? patch.announceChannelId : cur.announceChannelId,
    announceMessage: patch.announceMessage !== undefined ? patch.announceMessage : cur.announceMessage,
  }
  db().prepare(`
    INSERT INTO blesscastle_config
      (guild_id, voice_channel_ids, min_minutes, session_start_hour, session_end_hour, enabled,
       announce_channel_id, announce_message, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(guild_id) DO UPDATE SET
      voice_channel_ids = excluded.voice_channel_ids,
      min_minutes = excluded.min_minutes,
      session_start_hour = excluded.session_start_hour,
      session_end_hour = excluded.session_end_hour,
      enabled = excluded.enabled,
      announce_channel_id = excluded.announce_channel_id,
      announce_message = excluded.announce_message,
      updated_at = unixepoch()
  `).run(
    guildId,
    JSON.stringify(next.voiceChannelIds),
    next.minMinutes,
    next.sessionStartHour,
    next.sessionEndHour,
    next.enabled ? 1 : 0,
    next.announceChannelId || null,
    next.announceMessage || null,
  )
  _configCache.delete(guildId)
  return getConfig(guildId)
}

function listEnabledGuildIds() {
  return db()
    .prepare('SELECT guild_id FROM blesscastle_config WHERE enabled = 1')
    .all()
    .map(r => r.guild_id)
}

// ============================================================
// Stars

function getStarsRow(guildId, userId) {
  return db()
    .prepare('SELECT * FROM blesscastle_stars WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId)
}

function getStars(guildId, userId) {
  const r = getStarsRow(guildId, userId)
  if (!r || r.deleted_at) return 0
  return r.stars || 0
}

function listActiveStars(guildId) {
  return db()
    .prepare(`
      SELECT user_id, stars, last_updated
      FROM blesscastle_stars
      WHERE guild_id = ? AND deleted_at IS NULL
      ORDER BY stars DESC, last_updated ASC
    `)
    .all(guildId)
}

function incrementStars(guildId, userId, delta = 1) {
  db().prepare(`
    INSERT INTO blesscastle_stars (guild_id, user_id, stars, last_updated)
    VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      stars = stars + ?,
      last_updated = unixepoch(),
      deleted_at = NULL
  `).run(guildId, userId, delta, delta)
}

function resetStars(guildId, userId) {
  db().prepare(`
    UPDATE blesscastle_stars SET stars = 0, last_updated = unixepoch()
    WHERE guild_id = ? AND user_id = ?
  `).run(guildId, userId)
}

function softDeleteUser(guildId, userId) {
  db().prepare(`
    UPDATE blesscastle_stars SET deleted_at = unixepoch()
    WHERE guild_id = ? AND user_id = ?
  `).run(guildId, userId)
}

function restoreUser(guildId, userId) {
  db().prepare(`
    UPDATE blesscastle_stars SET deleted_at = NULL
    WHERE guild_id = ? AND user_id = ?
  `).run(guildId, userId)
}

function purgeSoftDeleted(olderThanUnix) {
  const rows = db()
    .prepare('SELECT guild_id, user_id FROM blesscastle_stars WHERE deleted_at IS NOT NULL AND deleted_at < ?')
    .all(olderThanUnix)
  const delStars = db().prepare('DELETE FROM blesscastle_stars WHERE guild_id = ? AND user_id = ?')
  const delAtt = db().prepare('DELETE FROM blesscastle_attendance WHERE guild_id = ? AND user_id = ?')
  const tx = db().transaction((list) => {
    for (const r of list) { delStars.run(r.guild_id, r.user_id); delAtt.run(r.guild_id, r.user_id) }
  })
  tx(rows)
  return rows.length
}

// ============================================================
// Attendance

function addVoiceSeconds(guildId, userId, weekKey, seconds) {
  if (seconds <= 0) return
  db().prepare(`
    INSERT INTO blesscastle_attendance (guild_id, user_id, week_key, voice_seconds, updated_at)
    VALUES (?, ?, ?, ?, unixepoch())
    ON CONFLICT(guild_id, user_id, week_key) DO UPDATE SET
      voice_seconds = voice_seconds + ?,
      updated_at = unixepoch()
  `).run(guildId, userId, weekKey, seconds, seconds)
}

function setManualAttendance(guildId, userId, weekKey, value) {
  const v = value ? 1 : 0
  db().prepare(`
    INSERT INTO blesscastle_attendance (guild_id, user_id, week_key, attended_manual, updated_at)
    VALUES (?, ?, ?, ?, unixepoch())
    ON CONFLICT(guild_id, user_id, week_key) DO UPDATE SET
      attended_manual = ?,
      updated_at = unixepoch()
  `).run(guildId, userId, weekKey, v, v)
}

// Tick manual + auto-award +1 sao NGAY LAP TUC neu user chua duoc award tuan do.
// Set finalized=1 sau khi award de finalizeWeek() sau khong double-award.
// Chong double khi: voice >= min (da qualify), attended_manual da 1, hoac finalized=1.
// Return: { awarded: true/false } - true neu vua cong +1 sao.
function setManualAttendanceWithAutoAward(guildId, userId, weekKey, minSeconds) {
  const cur = getUserWeekAttendance(guildId, userId, weekKey)
  // alreadyEligible = da hoac se duoc award (voice>=min tai finalize, hoac attended da 1)
  // Nguyen tac: tick chi grant khi !alreadyEligible.
  //  - Voice>=min truoc tick: finalize se cong -> khong grant o day (tranh double)
  //  - Attended da 1: da xu ly truoc do (co the da awarded hoac cho finalize) -> khong grant
  //  - Con lai: chua co gi -> grant ngay + set finalized=1 chan double khi finalize
  const alreadyEligible = cur.attended_manual === 1 || cur.voice_seconds >= minSeconds

  const tx = db().transaction(() => {
    setManualAttendance(guildId, userId, weekKey, 1)
    if (!alreadyEligible) {
      incrementStars(guildId, userId, 1)
      db().prepare(`
        UPDATE blesscastle_attendance SET finalized = 1
        WHERE guild_id = ? AND user_id = ? AND week_key = ?
      `).run(guildId, userId, weekKey)
    }
  })
  tx()

  return { awarded: !alreadyEligible }
}

function getWeekAttendance(guildId, weekKey) {
  return db()
    .prepare(`
      SELECT user_id, voice_seconds, attended_manual, finalized
      FROM blesscastle_attendance
      WHERE guild_id = ? AND week_key = ?
    `)
    .all(guildId, weekKey)
}

function getUserWeekAttendance(guildId, userId, weekKey) {
  return db()
    .prepare(`
      SELECT voice_seconds, attended_manual, finalized
      FROM blesscastle_attendance
      WHERE guild_id = ? AND user_id = ? AND week_key = ?
    `)
    .get(guildId, userId, weekKey) || { voice_seconds: 0, attended_manual: 0, finalized: 0 }
}

// Finalize 1 tuan: user co voice >= minSeconds HOAC attended_manual → stars += 1.
// Return list userIds awarded.
function finalizeWeek(guildId, weekKey, minSeconds) {
  const rows = db()
    .prepare(`
      SELECT user_id, voice_seconds, attended_manual
      FROM blesscastle_attendance
      WHERE guild_id = ? AND week_key = ? AND finalized = 0
    `)
    .all(guildId, weekKey)
  const awarded = []
  const tx = db().transaction(() => {
    const markFinal = db().prepare(`
      UPDATE blesscastle_attendance SET finalized = 1
      WHERE guild_id = ? AND user_id = ? AND week_key = ?
    `)
    for (const r of rows) {
      const ok = r.attended_manual || (r.voice_seconds >= minSeconds)
      if (ok) {
        incrementStars(guildId, r.user_id, 1)
        awarded.push(r.user_id)
      }
      markFinal.run(guildId, r.user_id, weekKey)
    }
  })
  tx()
  return awarded
}

// Danh sach cac tuan da co du lieu (voice hoac manual), DESC theo week_key.
function listWeeks(guildId, limit = 20) {
  return db()
    .prepare(`
      SELECT week_key,
             COUNT(*) AS total,
             SUM(CASE WHEN attended_manual = 1 THEN 1 ELSE 0 END) AS manual_count,
             SUM(CASE WHEN finalized = 1 THEN 1 ELSE 0 END) AS finalized_count
      FROM blesscastle_attendance
      WHERE guild_id = ?
      GROUP BY week_key
      ORDER BY week_key DESC
      LIMIT ?
    `)
    .all(guildId, limit)
}

// Reset toan bo du lieu BlessCastle cua 1 guild (GIU LAI config).
function resetAllData(guildId) {
  const tx = db().transaction(() => {
    db().prepare('DELETE FROM blesscastle_stars WHERE guild_id = ?').run(guildId)
    db().prepare('DELETE FROM blesscastle_attendance WHERE guild_id = ?').run(guildId)
    db().prepare('DELETE FROM blesscastle_redemptions WHERE guild_id = ?').run(guildId)
  })
  tx()
}

// ============================================================
// Redemptions

function createRedemption(guildId, userId, adminId, starsAt) {
  const tx = db().transaction(() => {
    db().prepare(`
      INSERT INTO blesscastle_redemptions (guild_id, user_id, admin_id, redeemed_at, stars_at_redemption)
      VALUES (?, ?, ?, unixepoch(), ?)
    `).run(guildId, userId, adminId, starsAt)
    resetStars(guildId, userId)
  })
  tx()
}

function listRedemptions(guildId, limit = 50, offset = 0) {
  return db()
    .prepare(`
      SELECT id, user_id, admin_id, redeemed_at, stars_at_redemption
      FROM blesscastle_redemptions
      WHERE guild_id = ?
      ORDER BY redeemed_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(guildId, limit, offset)
}

function countRedemptions(guildId) {
  const row = db()
    .prepare('SELECT COUNT(*) AS n FROM blesscastle_redemptions WHERE guild_id = ?')
    .get(guildId)
  return row?.n || 0
}

module.exports = {
  initBlessCastleSchema,
  DEFAULT_ANNOUNCE_MESSAGE,
  // time
  currentWeekKey,
  activeWeekKey,
  getClosedWeek,
  setClosedWeek,
  isoWeekKey,
  saigonDate,
  isInManualWindow,
  // config
  getConfig,
  upsertConfig,
  listEnabledGuildIds,
  // stars
  getStars,
  getStarsRow,
  listActiveStars,
  incrementStars,
  resetStars,
  softDeleteUser,
  restoreUser,
  purgeSoftDeleted,
  // attendance
  addVoiceSeconds,
  setManualAttendance,
  setManualAttendanceWithAutoAward,
  getWeekAttendance,
  getUserWeekAttendance,
  finalizeWeek,
  listWeeks,
  resetAllData,
  // redemptions
  createRedemption,
  listRedemptions,
  countRedemptions,
}
