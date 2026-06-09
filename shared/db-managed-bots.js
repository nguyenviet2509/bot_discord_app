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

// desired_state: trang thai user MUON bot o ('running' | 'stopped'). Tach
// khoi `status` (runtime actual) de boot dashboard co the tu start lai bot
// user da chu y bat (xem bots-lite/index.js#restoreAll).
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS managed_bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    discord_token TEXT NOT NULL,
    token_iv TEXT NOT NULL,
    application_id TEXT,
    status TEXT NOT NULL DEFAULT 'stopped',
    desired_state TEXT NOT NULL DEFAULT 'stopped',
    presence_status TEXT NOT NULL DEFAULT 'online',
    activity_type TEXT NOT NULL DEFAULT 'Playing',
    activity_text TEXT,
    last_error TEXT,
    last_username_change INTEGER,
    autochat_enabled INTEGER NOT NULL DEFAULT 0,
    autochat_channel_id TEXT,
    autochat_min_minutes INTEGER NOT NULL DEFAULT 60,
    autochat_max_minutes INTEGER NOT NULL DEFAULT 180,
    autochat_silence_skip_hours INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS managed_bot_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    FOREIGN KEY (bot_id) REFERENCES managed_bots(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_managed_bot_messages_bot_id ON managed_bot_messages(bot_id);
`

function initManagedBotsSchema(database) {
  database.exec(SCHEMA_SQL)
  // Migration: them desired_state cho DB cu da co bang
  const cols = database.prepare("PRAGMA table_info(managed_bots)").all()
  if (!cols.some((c) => c.name === 'desired_state')) {
    database.exec("ALTER TABLE managed_bots ADD COLUMN desired_state TEXT NOT NULL DEFAULT 'stopped'")
    // Backfill: bot dang `running` lan migration → desired = running
    database.exec("UPDATE managed_bots SET desired_state = 'running' WHERE status = 'running'")
  }
  // Migration: them cac cot autochat
  if (!cols.some((c) => c.name === 'autochat_enabled')) {
    database.exec("ALTER TABLE managed_bots ADD COLUMN autochat_enabled INTEGER NOT NULL DEFAULT 0")
    database.exec("ALTER TABLE managed_bots ADD COLUMN autochat_channel_id TEXT")
    database.exec("ALTER TABLE managed_bots ADD COLUMN autochat_min_minutes INTEGER NOT NULL DEFAULT 60")
    database.exec("ALTER TABLE managed_bots ADD COLUMN autochat_max_minutes INTEGER NOT NULL DEFAULT 180")
    database.exec("ALTER TABLE managed_bots ADD COLUMN autochat_silence_skip_hours INTEGER NOT NULL DEFAULT 0")
  } else if (!cols.some((c) => c.name === 'autochat_silence_skip_hours')) {
    // Migration phu cho ban da co autochat nhung chua co silence_skip
    database.exec("ALTER TABLE managed_bots ADD COLUMN autochat_silence_skip_hours INTEGER NOT NULL DEFAULT 0")
  }
}

function db() {
  return require('./db').getDb()
}

// Khong tra ve token/iv — danh cho dashboard list
function listBots() {
  return db()
    .prepare(`
      SELECT id, display_name, avatar_url, application_id, status, desired_state,
             presence_status, activity_type, activity_text,
             last_error, last_username_change, autochat_enabled,
             created_at, updated_at
      FROM managed_bots
      ORDER BY id ASC
    `)
    .all()
}

// IDs cua bot user muon o trang thai running — dung de auto-restore khi boot
function listDesiredRunningIds() {
  return db()
    .prepare("SELECT id FROM managed_bots WHERE desired_state = 'running' ORDER BY id ASC")
    .all()
    .map((r) => r.id)
}

function setDesiredState(id, state) {
  if (state !== 'running' && state !== 'stopped') return
  db()
    .prepare('UPDATE managed_bots SET desired_state = ?, updated_at = ? WHERE id = ?')
    .run(state, Date.now(), id)
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
      SELECT id, display_name, avatar_url, application_id, status, desired_state,
             presence_status, activity_type, activity_text,
             last_error, last_username_change, autochat_enabled,
             created_at, updated_at
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

// === Autochat config ===

function getAutochatConfig(id) {
  const row = db()
    .prepare(`
      SELECT autochat_enabled AS enabled,
             autochat_channel_id AS channel_id,
             autochat_min_minutes AS min_minutes,
             autochat_max_minutes AS max_minutes,
             autochat_silence_skip_hours AS silence_skip_hours
      FROM managed_bots WHERE id = ?
    `)
    .get(id)
  if (!row) return null
  return {
    enabled: !!row.enabled,
    channel_id: row.channel_id || null,
    min_minutes: row.min_minutes,
    max_minutes: row.max_minutes,
    silence_skip_hours: row.silence_skip_hours,
  }
}

const AUTOCHAT_PATCH_FIELDS = {
  enabled: 'autochat_enabled',
  channel_id: 'autochat_channel_id',
  min_minutes: 'autochat_min_minutes',
  max_minutes: 'autochat_max_minutes',
  silence_skip_hours: 'autochat_silence_skip_hours',
}

function updateAutochatConfig(id, patch) {
  const sets = []
  const params = { id, now: Date.now() }
  for (const [key, col] of Object.entries(AUTOCHAT_PATCH_FIELDS)) {
    if (patch[key] === undefined) continue
    if (key === 'enabled') {
      params[key] = patch[key] ? 1 : 0
    } else {
      params[key] = patch[key]
    }
    sets.push(`${col} = @${key}`)
  }
  if (sets.length === 0) return
  sets.push('updated_at = @now')
  db().prepare(`UPDATE managed_bots SET ${sets.join(', ')} WHERE id = @id`).run(params)
}

// Tra ve danh sach bot id co autochat_enabled=1 (dung de restore scheduler)
function listAutochatEnabledIds() {
  return db()
    .prepare('SELECT id FROM managed_bots WHERE autochat_enabled = 1 ORDER BY id ASC')
    .all()
    .map((r) => r.id)
}

// === Messages ===

function listMessages(botId) {
  return db()
    .prepare('SELECT id, content, created_at FROM managed_bot_messages WHERE bot_id = ? ORDER BY id ASC')
    .all(botId)
}

function addMessage(botId, content) {
  const info = db()
    .prepare('INSERT INTO managed_bot_messages (bot_id, content) VALUES (?, ?)')
    .run(botId, content)
  return info.lastInsertRowid
}

// Chi xoa neu message thuoc dung bot — tranh leak qua bot khac
function deleteMessage(messageId, botId) {
  return db()
    .prepare('DELETE FROM managed_bot_messages WHERE id = ? AND bot_id = ?')
    .run(messageId, botId).changes
}

module.exports = {
  initManagedBotsSchema,
  listBots,
  listDesiredRunningIds,
  getBot,
  getBotFull,
  createBot,
  updateBot,
  updateStatus,
  setDesiredState,
  recordUsernameChange,
  deleteBot,
  getAutochatConfig,
  updateAutochatConfig,
  listAutochatEnabledIds,
  listMessages,
  addMessage,
  deleteMessage,
}
