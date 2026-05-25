// DB schema + helpers cho module system & mini-game PvP.
// Dung chung SQLite connection voi shared/db.js (lay qua getDb()).

const SCHEMA_SQL = `
  -- Bat/tat module theo guild
  CREATE TABLE IF NOT EXISTS guild_modules (
    guild_id    TEXT NOT NULL,
    module_key  TEXT NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 0,
    updated_at  INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (guild_id, module_key)
  );

  -- Vi coin cua user trong guild
  CREATE TABLE IF NOT EXISTS user_coin (
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    balance     INTEGER NOT NULL DEFAULT 0,
    updated_at  INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (guild_id, user_id)
  );

  -- Lich su giao dich coin (audit)
  CREATE TABLE IF NOT EXISTS coin_tx (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    delta       INTEGER NOT NULL,
    reason      TEXT,
    created_at  INTEGER DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_tx(guild_id, user_id, created_at DESC);

  -- Tran dau PvP (rps / oddeven / guess) - state machine
  CREATE TABLE IF NOT EXISTS pvp_match (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    channel_id   TEXT NOT NULL,
    message_id   TEXT,
    game         TEXT NOT NULL,
    player_a     TEXT NOT NULL,
    player_b     TEXT NOT NULL,
    stake        INTEGER NOT NULL,
    state        TEXT NOT NULL,
    pick_a       TEXT,
    pick_b       TEXT,
    winner       TEXT,
    meta         TEXT,
    created_at   INTEGER DEFAULT (unixepoch()),
    finished_at  INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_pvp_state ON pvp_match(state, created_at);
  CREATE INDEX IF NOT EXISTS idx_pvp_player_a ON pvp_match(guild_id, player_a, state);
  CREATE INDEX IF NOT EXISTS idx_pvp_player_b ON pvp_match(guild_id, player_b, state);

  -- Mini-game ROLL multi-player: session header + participant detail
  CREATE TABLE IF NOT EXISTS roll_session (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    channel_id    TEXT NOT NULL,
    message_id    TEXT,
    host_id       TEXT NOT NULL,
    max_players   INTEGER NOT NULL DEFAULT 100,
    state         TEXT NOT NULL,
    expires_at    INTEGER NOT NULL,
    winner_id     TEXT,
    winner_score  INTEGER,
    cancel_reason TEXT,
    created_at    INTEGER DEFAULT (unixepoch()),
    finished_at   INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_roll_state ON roll_session(guild_id, state);
  CREATE INDEX IF NOT EXISTS idx_roll_created ON roll_session(guild_id, created_at DESC);
  -- Partial unique index: 1 guild chi co toi da 1 session 'open' hoac 'rolling' cung luc
  CREATE UNIQUE INDEX IF NOT EXISTS idx_roll_one_active
    ON roll_session(guild_id) WHERE state IN ('open','rolling');

  CREATE TABLE IF NOT EXISTS roll_participant (
    session_id  INTEGER NOT NULL,
    user_id     TEXT NOT NULL,
    score       INTEGER,
    joined_at   INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (session_id, user_id),
    FOREIGN KEY (session_id) REFERENCES roll_session(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_roll_part_session ON roll_participant(session_id, score DESC);
`

function initMiniGameSchema(database) {
  database.exec(SCHEMA_SQL)
}

// Lazy lookup de tranh circular require luc load module.
function db() {
  return require('./db').getDb()
}

// ============================================================
// Module toggle
// ============================================================
// Tra ve null neu chua co row -> caller fallback manifest.defaultEnabled.
function isModuleEnabled(guildId, moduleKey) {
  const row = db().prepare(
    'SELECT enabled FROM guild_modules WHERE guild_id = ? AND module_key = ?'
  ).get(guildId, moduleKey)
  if (!row) return null
  return !!row.enabled
}

function setModuleEnabled(guildId, moduleKey, enabled) {
  db().prepare(`
    INSERT INTO guild_modules (guild_id, module_key, enabled, updated_at)
    VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(guild_id, module_key) DO UPDATE
      SET enabled = excluded.enabled, updated_at = unixepoch()
  `).run(guildId, moduleKey, enabled ? 1 : 0)
}

// ============================================================
// Coin economy
// ============================================================
function getCoin(guildId, userId) {
  const row = db().prepare(
    'SELECT balance FROM user_coin WHERE guild_id = ? AND user_id = ?'
  ).get(guildId, userId)
  return row ? row.balance : 0
}

// Atomic: UPSERT balance + INSERT coin_tx trong cung 1 transaction.
// delta co the am, cho phep balance am.
function addCoin(guildId, userId, delta, reason) {
  const conn = db()
  const txn = conn.transaction(() => {
    conn.prepare(`
      INSERT INTO user_coin (guild_id, user_id, balance, updated_at)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(guild_id, user_id) DO UPDATE
        SET balance = balance + excluded.balance, updated_at = unixepoch()
    `).run(guildId, userId, delta)
    conn.prepare(
      'INSERT INTO coin_tx (guild_id, user_id, delta, reason) VALUES (?, ?, ?, ?)'
    ).run(guildId, userId, delta, reason || null)
  })
  txn()
}

function getCoinHistory(guildId, userId, limit = 10) {
  return db().prepare(`
    SELECT delta, reason, created_at
    FROM coin_tx
    WHERE guild_id = ? AND user_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(guildId, userId, limit)
}

module.exports = {
  initMiniGameSchema,
  isModuleEnabled,
  setModuleEnabled,
  getCoin,
  addCoin,
  getCoinHistory,
}
