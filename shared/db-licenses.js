// DB helpers cho module license activation.
// Dung chung SQLite connection voi shared/db.js (lay qua getDb()).
// Schema duoc khoi tao bang initLicensesSchema() goi tu shared/db.js#initDb().

const crypto = require('crypto')

function db() {
  return require('./db').getDb()
}

// ---- Schema ----

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    machine_id TEXT,
    machine_id_short TEXT,
    user_label TEXT,
    discord_user_id TEXT,
    issued_by_discord_id TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    activated_at INTEGER,
    expires_at INTEGER,
    revoked INTEGER NOT NULL DEFAULT 0,
    last_seen INTEGER,
    last_ip TEXT,
    app_version TEXT,
    note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_licenses_discord_user ON licenses(discord_user_id);

  CREATE TABLE IF NOT EXISTS license_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_id INTEGER,
    type TEXT NOT NULL,
    ip TEXT, ua TEXT,
    ts INTEGER DEFAULT (unixepoch()),
    meta_json TEXT,
    FOREIGN KEY(license_id) REFERENCES licenses(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_events_license ON license_events(license_id, ts);
`

function initLicensesSchema(database) {
  database.exec(SCHEMA_SQL)
}

// ---- CRUD ----

// Tao token moi. Token = 32 hex chars (16 bytes random).
// Returns { id, token } — token plaintext chi tra ve 1 lan.
function createToken({ user_label, expires_at, note, machine_id, machine_id_short, discord_user_id, issued_by_discord_id } = {}) {
  const token = crypto.randomBytes(16).toString('hex')
  const info = db().prepare(
    `INSERT INTO licenses (token, user_label, expires_at, note, machine_id, machine_id_short, discord_user_id, issued_by_discord_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    token,
    user_label || null,
    expires_at || null,
    note || null,
    machine_id || null,
    machine_id_short || null,
    discord_user_id || null,
    issued_by_discord_id || null
  )
  return { id: info.lastInsertRowid, token }
}

function findByToken(token) {
  return db().prepare('SELECT * FROM licenses WHERE token = ?').get(token)
}

function getById(id) {
  return db().prepare('SELECT * FROM licenses WHERE id = ?').get(id)
}

// Lan activate dau tien: atomic conditional bind — chi update khi machine_id IS NULL hoac khop.
// Returns info.changes (0 = race lost hoac da co machine khac; 1 = thanh cong).
function bindMachine(id, machine_id, machine_id_short, ip, ua, app_version) {
  const now = Math.floor(Date.now() / 1000)
  const info = db().prepare(
    `UPDATE licenses SET
       machine_id = ?,
       machine_id_short = ?,
       activated_at = COALESCE(activated_at, unixepoch()),
       last_seen = ?,
       last_ip = ?,
       app_version = COALESCE(?, app_version)
     WHERE id = ? AND (machine_id IS NULL OR machine_id = ?)`
  ).run(machine_id, machine_id_short || null, now, ip || null, app_version || null, id, machine_id)
  return info.changes
}

// Cap nhat last_seen moi khi verify/activate thanh cong
function touchSeen(id, ip, app_version) {
  const now = Math.floor(Date.now() / 1000)
  db().prepare(
    `UPDATE licenses SET last_seen = ?, last_ip = ?, app_version = COALESCE(?, app_version) WHERE id = ?`
  ).run(now, ip || null, app_version || null, id)
}

function revoke(id) {
  db().prepare('UPDATE licenses SET revoked = 1 WHERE id = ?').run(id)
}

function resetMachine(id) {
  db().prepare(
    'UPDATE licenses SET machine_id = NULL, machine_id_short = NULL, activated_at = NULL WHERE id = ?'
  ).run(id)
}

// Update label/expiry/note tu admin
function update(id, { user_label, expires_at, note } = {}) {
  const sets = []
  const params = { id }
  if (user_label !== undefined) { sets.push('user_label = @user_label'); params.user_label = user_label }
  if (expires_at !== undefined) { sets.push('expires_at = @expires_at'); params.expires_at = expires_at }
  if (note !== undefined)       { sets.push('note = @note'); params.note = note }
  if (sets.length === 0) return
  db().prepare(`UPDATE licenses SET ${sets.join(', ')} WHERE id = @id`).run(params)
}

// List tat ca licenses, mask token: 4...4 chars
function list() {
  const rows = db().prepare('SELECT * FROM licenses ORDER BY id DESC').all()
  return rows.map(maskToken)
}

function maskToken(row) {
  if (!row) return row
  const t = row.token
  return { ...row, token: t ? `${t.slice(0, 4)}...${t.slice(-4)}` : null }
}

// Ghi event vao license_events
function recordEvent(license_id, type, ip, ua, meta) {
  db().prepare(
    `INSERT INTO license_events (license_id, type, ip, ua, meta_json) VALUES (?, ?, ?, ?, ?)`
  ).run(
    license_id,
    type,
    ip || null,
    ua || null,
    meta ? JSON.stringify(meta) : null
  )
}

// Lay 50 event gan nhat cua 1 license
function listEvents(license_id) {
  return db()
    .prepare('SELECT * FROM license_events WHERE license_id = ? ORDER BY ts DESC LIMIT 50')
    .all(license_id)
}

module.exports = {
  initLicensesSchema,
  createToken,
  findByToken,
  getById,
  bindMachine,
  touchSeen,
  revoke,
  resetMachine,
  update,
  list,
  recordEvent,
  listEvents,
}
