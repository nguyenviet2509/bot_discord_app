// DB schema + helpers cho module Auto-Mod Lite.
// Dung chung SQLite connection voi shared/db.js (lay qua getDb()).
//
// 4 bang:
//   - automod_config: cau hinh per-guild per-rule (enabled + params JSON)
//   - automod_whitelist: channel/role duoc mien check
//   - automod_warns: log warn de tinh ladder action (reset sau N giay)
//   - automod_logs: lich su xu phat (audit + dashboard viewer)

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS automod_config (
    guild_id    TEXT NOT NULL,
    rule_name   TEXT NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 0,
    params_json TEXT NOT NULL DEFAULT '{}',
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (guild_id, rule_name)
  );

  CREATE TABLE IF NOT EXISTS automod_whitelist (
    guild_id TEXT NOT NULL,
    type     TEXT NOT NULL,
    id       TEXT NOT NULL,
    PRIMARY KEY (guild_id, type, id)
  );

  CREATE TABLE IF NOT EXISTS automod_warns (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    rule       TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_automod_warns_user ON automod_warns(guild_id, user_id, created_at);

  CREATE TABLE IF NOT EXISTS automod_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id        TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    rule            TEXT NOT NULL,
    action          TEXT NOT NULL,
    message_excerpt TEXT,
    channel_id      TEXT,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_automod_logs_guild ON automod_logs(guild_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_automod_logs_user ON automod_logs(guild_id, user_id, created_at DESC);
`

function initAutomodSchema(database) {
  database.exec(SCHEMA_SQL)
}

// Lazy resolver de tranh circular require voi db.js
function db() {
  return require('./db').getDb()
}

// ============================================================
// Config
// ============================================================

// Tra ve dict: { 'anti-spam': {enabled, params}, ... }
function getConfig(guildId) {
  const rows = db()
    .prepare('SELECT rule_name, enabled, params_json FROM automod_config WHERE guild_id = ?')
    .all(guildId)
  const out = {}
  for (const r of rows) {
    let params = {}
    try { params = r.params_json ? JSON.parse(r.params_json) : {} } catch (_) { params = {} }
    out[r.rule_name] = { enabled: !!r.enabled, params }
  }
  return out
}

function getRuleConfig(guildId, ruleName) {
  const row = db()
    .prepare('SELECT enabled, params_json FROM automod_config WHERE guild_id = ? AND rule_name = ?')
    .get(guildId, ruleName)
  if (!row) return null
  let params = {}
  try { params = row.params_json ? JSON.parse(row.params_json) : {} } catch (_) { params = {} }
  return { enabled: !!row.enabled, params }
}

function upsertRuleConfig(guildId, ruleName, enabled, params) {
  const paramsJson = JSON.stringify(params || {})
  return db()
    .prepare(`
      INSERT INTO automod_config (guild_id, rule_name, enabled, params_json, updated_at)
      VALUES (?, ?, ?, ?, unixepoch())
      ON CONFLICT(guild_id, rule_name) DO UPDATE SET
        enabled = excluded.enabled,
        params_json = excluded.params_json,
        updated_at = unixepoch()
    `)
    .run(guildId, ruleName, enabled ? 1 : 0, paramsJson)
}

// ============================================================
// Whitelist
// ============================================================

function listWhitelist(guildId) {
  const rows = db()
    .prepare('SELECT type, id FROM automod_whitelist WHERE guild_id = ?')
    .all(guildId)
  const channels = []
  const roles = []
  for (const r of rows) {
    if (r.type === 'channel') channels.push(r.id)
    else if (r.type === 'role') roles.push(r.id)
  }
  return { channels, roles }
}

function addWhitelist(guildId, type, id) {
  if (type !== 'channel' && type !== 'role') throw new Error('Invalid whitelist type')
  return db()
    .prepare('INSERT OR IGNORE INTO automod_whitelist (guild_id, type, id) VALUES (?, ?, ?)')
    .run(guildId, type, id)
}

function removeWhitelist(guildId, type, id) {
  return db()
    .prepare('DELETE FROM automod_whitelist WHERE guild_id = ? AND type = ? AND id = ?')
    .run(guildId, type, id)
}

// Hot path: check 1 message co thuoc whitelist khong.
// roleIds: array role id cua member.
function isWhitelisted(guildId, channelId, roleIds) {
  const wl = listWhitelist(guildId)
  if (channelId && wl.channels.includes(channelId)) return true
  if (Array.isArray(roleIds) && roleIds.some(rid => wl.roles.includes(rid))) return true
  return false
}

// ============================================================
// Warns
// ============================================================

function addWarn(guildId, userId, rule) {
  return db()
    .prepare('INSERT INTO automod_warns (guild_id, user_id, rule) VALUES (?, ?, ?)')
    .run(guildId, userId, rule)
}

// Dem warn trong khoang [now - expirySec, now]. Mac dinh 24h.
function countActiveWarns(guildId, userId, expirySec = 86400) {
  const since = Math.floor(Date.now() / 1000) - expirySec
  const row = db()
    .prepare('SELECT COUNT(*) AS t FROM automod_warns WHERE guild_id = ? AND user_id = ? AND created_at >= ?')
    .get(guildId, userId, since)
  return (row && row.t) || 0
}

function clearWarns(guildId, userId) {
  return db()
    .prepare('DELETE FROM automod_warns WHERE guild_id = ? AND user_id = ?')
    .run(guildId, userId)
}

// ============================================================
// Logs
// ============================================================

function addLog({ guildId, userId, rule, action, messageExcerpt, channelId }) {
  return db()
    .prepare(`
      INSERT INTO automod_logs (guild_id, user_id, rule, action, message_excerpt, channel_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(guildId, userId, rule, action, messageExcerpt || null, channelId || null)
}

function listLogs(guildId, { userId, rule, action, from, to, limit = 50, offset = 0 } = {}) {
  let q = 'SELECT * FROM automod_logs WHERE guild_id = @guild_id'
  const params = { guild_id: guildId, limit, offset }
  if (userId) { q += ' AND user_id = @user_id'; params.user_id = userId }
  if (rule) { q += ' AND rule = @rule'; params.rule = rule }
  if (action) { q += ' AND action = @action'; params.action = action }
  if (from) { q += ' AND created_at >= @from'; params.from = from }
  if (to) { q += ' AND created_at <= @to'; params.to = to }
  q += ' ORDER BY created_at DESC LIMIT @limit OFFSET @offset'
  return db().prepare(q).all(params)
}

function countLogs(guildId, { userId, rule, action, from, to } = {}) {
  let q = 'SELECT COUNT(*) AS t FROM automod_logs WHERE guild_id = @guild_id'
  const params = { guild_id: guildId }
  if (userId) { q += ' AND user_id = @user_id'; params.user_id = userId }
  if (rule) { q += ' AND rule = @rule'; params.rule = rule }
  if (action) { q += ' AND action = @action'; params.action = action }
  if (from) { q += ' AND created_at >= @from'; params.from = from }
  if (to) { q += ' AND created_at <= @to'; params.to = to }
  return (db().prepare(q).get(params) || {}).t || 0
}

// Thong ke vi pham theo rule trong N ngay
function getStatsByRule(guildId, days = 7) {
  const since = Math.floor(Date.now() / 1000) - days * 86400
  return db()
    .prepare(`
      SELECT rule, COUNT(*) AS total
      FROM automod_logs
      WHERE guild_id = ? AND created_at >= ?
      GROUP BY rule
      ORDER BY total DESC
    `)
    .all(guildId, since)
}

// Top user vi pham trong N ngay
function getTopOffenders(guildId, days = 7, limit = 10) {
  const since = Math.floor(Date.now() / 1000) - days * 86400
  return db()
    .prepare(`
      SELECT user_id, COUNT(*) AS total
      FROM automod_logs
      WHERE guild_id = ? AND created_at >= ?
      GROUP BY user_id
      ORDER BY total DESC
      LIMIT ?
    `)
    .all(guildId, since, limit)
}

module.exports = {
  initAutomodSchema,
  // config
  getConfig,
  getRuleConfig,
  upsertRuleConfig,
  // whitelist
  listWhitelist,
  addWhitelist,
  removeWhitelist,
  isWhitelisted,
  // warns
  addWarn,
  countActiveWarns,
  clearWarns,
  // logs
  addLog,
  listLogs,
  countLogs,
  getStatsByRule,
  getTopOffenders,
}
