// DB schema + helpers cho module quan ly bot phu (multi lite bots).
// Dung chung SQLite connection voi shared/db.js (lay qua getDb()).
//
// Bang managed_bots:
//   - discord_token: ciphertext AES-256-GCM base64 (xem bots-lite/token-crypto.js)
//   - token_iv: IV base64
//   - status: 'stopped' | 'running' | 'error'
//   - presence_status: 'online' | 'idle' | 'dnd' | 'invisible'
//   - activity_type: 'Playing' | 'Watching' | 'Listening' | 'Competing' | 'Custom'
//   - last_username_change: unix ms — dung de UI cooldown rate limit (Discord ~2/h)

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS managed_bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    discord_token TEXT NOT NULL,
    token_iv TEXT NOT NULL,
    application_id TEXT,
    status TEXT NOT NULL DEFAULT 'stopped',
    presence_status TEXT NOT NULL DEFAULT 'online',
    activity_type TEXT NOT NULL DEFAULT 'Playing',
    activity_text TEXT,
    last_error TEXT,
    last_username_change INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
`

function initManagedBotsSchema(database) {
  database.exec(SCHEMA_SQL)
}

function db() {
  return require('./db').getDb()
}

// Khong tra ve token/iv — danh cho dashboard list
function listBots() {
  return db()
    .prepare(`
      SELECT id, display_name, avatar_url, application_id, status,
             presence_status, activity_type, activity_text,
             last_error, last_username_change, created_at, updated_at
      FROM managed_bots
      ORDER BY id ASC
    `)
    .all()
}

// Full row (gom token+iv) — chi dung trong manager/internal
function getBotFull(id) {
  return db()
    .prepare('SELECT * FROM managed_bots WHERE id = ?')
    .get(id)
}

// Public view (no token/iv)
function getBot(id) {
  return db()
    .prepare(`
      SELECT id, display_name, avatar_url, application_id, status,
             presence_status, activity_type, activity_text,
             last_error, last_username_change, created_at, updated_at
      FROM managed_bots WHERE id = ?
    `)
    .get(id)
}

function createBot({
  display_name, avatar_url, discord_token, token_iv, application_id,
  presence_status, activity_type, activity_text,
}) {
  const now = Date.now()
  const info = db()
    .prepare(`
      INSERT INTO managed_bots (
        display_name, avatar_url, discord_token, token_iv, application_id,
        presence_status, activity_type, activity_text,
        created_at, updated_at
      ) VALUES (
        @display_name, @avatar_url, @discord_token, @token_iv, @application_id,
        @presence_status, @activity_type, @activity_text,
        @now, @now
      )
    `)
    .run({
      display_name,
      avatar_url: avatar_url || null,
      discord_token,
      token_iv,
      application_id: application_id || null,
      presence_status: presence_status || 'online',
      activity_type: activity_type || 'Playing',
      activity_text: activity_text || null,
      now,
    })
  return info.lastInsertRowid
}

// Partial update — chi cap nhat field co trong patch
const ALLOWED_PATCH_FIELDS = [
  'display_name', 'avatar_url', 'presence_status',
  'activity_type', 'activity_text',
]

function updateBot(id, patch) {
  const sets = []
  const params = { id, now: Date.now() }
  for (const key of ALLOWED_PATCH_FIELDS) {
    if (patch[key] !== undefined) {
      sets.push(`${key} = @${key}`)
      params[key] = patch[key]
    }
  }
  if (sets.length === 0) return
  sets.push('updated_at = @now')
  db().prepare(`UPDATE managed_bots SET ${sets.join(', ')} WHERE id = @id`).run(params)
}

function updateStatus(id, status, lastError = null) {
  db()
    .prepare('UPDATE managed_bots SET status = ?, last_error = ?, updated_at = ? WHERE id = ?')
    .run(status, lastError, Date.now(), id)
}

function recordUsernameChange(id) {
  db()
    .prepare('UPDATE managed_bots SET last_username_change = ?, updated_at = ? WHERE id = ?')
    .run(Date.now(), Date.now(), id)
}

function deleteBot(id) {
  db().prepare('DELETE FROM managed_bots WHERE id = ?').run(id)
}

module.exports = {
  initManagedBotsSchema,
  listBots,
  getBot,
  getBotFull,
  createBot,
  updateBot,
  updateStatus,
  recordUsernameChange,
  deleteBot,
}
