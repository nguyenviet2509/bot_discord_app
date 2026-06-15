// DB schema + helpers cho feature Worldcup match notifications.
// Dung chung SQLite connection voi shared/db.js (lay qua getDb()).
//
// 4 bang:
//   - worldcup_teams: 32 doi (code, name), seed 1 lan
//   - worldcup_matches: lich tran dau (global, owner CRUD)
//   - worldcup_guild_config: per-guild config (channel, N phut, role ping, tz)
//   - worldcup_notification_log: idempotency (match_id, guild_id)

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS worldcup_teams (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS worldcup_matches (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    team1_id      INTEGER NOT NULL REFERENCES worldcup_teams(id),
    team2_id      INTEGER NOT NULL REFERENCES worldcup_teams(id),
    kick_off_at   INTEGER NOT NULL,
    round         TEXT NOT NULL,
    group_name    TEXT,
    status        TEXT NOT NULL DEFAULT 'scheduled',
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_worldcup_matches_kickoff
    ON worldcup_matches(kick_off_at, status);

  CREATE TABLE IF NOT EXISTS worldcup_guild_config (
    guild_id                TEXT PRIMARY KEY,
    enabled                 INTEGER NOT NULL DEFAULT 0,
    channel_id              TEXT,
    notify_before_minutes   INTEGER NOT NULL DEFAULT 30,
    role_ping_id            TEXT,
    timezone                TEXT NOT NULL DEFAULT 'Asia/Saigon',
    updated_at              INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS worldcup_notification_log (
    match_id  INTEGER NOT NULL,
    guild_id  TEXT NOT NULL,
    sent_at   INTEGER NOT NULL,
    PRIMARY KEY (match_id, guild_id)
  );
`

// Seed 32 doi WC 2022 (code + ten Viet hoa).
const SEED_TEAMS = [
  { code: 'QAT', name: 'Qatar' }, { code: 'ECU', name: 'Ecuador' },
  { code: 'SEN', name: 'Senegal' }, { code: 'NED', name: 'Hà Lan' },
  { code: 'ENG', name: 'Anh' }, { code: 'IRN', name: 'Iran' },
  { code: 'USA', name: 'Mỹ' }, { code: 'WAL', name: 'Wales' },
  { code: 'ARG', name: 'Argentina' }, { code: 'KSA', name: 'Ả Rập Xê Út' },
  { code: 'MEX', name: 'Mexico' }, { code: 'POL', name: 'Ba Lan' },
  { code: 'FRA', name: 'Pháp' }, { code: 'AUS', name: 'Úc' },
  { code: 'DEN', name: 'Đan Mạch' }, { code: 'TUN', name: 'Tunisia' },
  { code: 'ESP', name: 'Tây Ban Nha' }, { code: 'CRC', name: 'Costa Rica' },
  { code: 'GER', name: 'Đức' }, { code: 'JPN', name: 'Nhật Bản' },
  { code: 'BEL', name: 'Bỉ' }, { code: 'CAN', name: 'Canada' },
  { code: 'MAR', name: 'Maroc' }, { code: 'CRO', name: 'Croatia' },
  { code: 'BRA', name: 'Brazil' }, { code: 'SRB', name: 'Serbia' },
  { code: 'SUI', name: 'Thụy Sĩ' }, { code: 'CMR', name: 'Cameroon' },
  { code: 'POR', name: 'Bồ Đào Nha' }, { code: 'GHA', name: 'Ghana' },
  { code: 'URU', name: 'Uruguay' }, { code: 'KOR', name: 'Hàn Quốc' },
]

function initWorldcupSchema(database) {
  database.exec(SCHEMA_SQL)
  // Seed teams neu rong
  const count = database.prepare('SELECT COUNT(*) AS c FROM worldcup_teams').get().c
  if (count === 0) {
    const stmt = database.prepare('INSERT INTO worldcup_teams (code, name) VALUES (?, ?)')
    const tx = database.transaction((rows) => {
      for (const r of rows) stmt.run(r.code, r.name)
    })
    tx(SEED_TEAMS)
    console.log(`[Worldcup] Seeded ${SEED_TEAMS.length} teams`)
  }
}

// Lazy resolver de tranh circular require voi db.js
function db() {
  return require('./db').getDb()
}

// ============================================================
// Teams
function listTeams() {
  return db().prepare('SELECT * FROM worldcup_teams ORDER BY name').all()
}

function getTeam(id) {
  return db().prepare('SELECT * FROM worldcup_teams WHERE id = ?').get(id)
}

function createTeam({ code, name }) {
  const info = db().prepare('INSERT INTO worldcup_teams (code, name) VALUES (?, ?)').run(code, name)
  return getTeam(info.lastInsertRowid)
}

function updateTeam(id, { code, name }) {
  db().prepare('UPDATE worldcup_teams SET code = COALESCE(?, code), name = COALESCE(?, name) WHERE id = ?')
    .run(code || null, name || null, id)
  return getTeam(id)
}

function deleteTeam(id) {
  // Block neu co match ref
  const refs = db().prepare('SELECT COUNT(*) AS c FROM worldcup_matches WHERE team1_id = ? OR team2_id = ?').get(id, id).c
  if (refs > 0) {
    const err = new Error(`Khong the xoa: doi nay duoc dung trong ${refs} tran dau`)
    err.code = 'TEAM_IN_USE'
    throw err
  }
  db().prepare('DELETE FROM worldcup_teams WHERE id = ?').run(id)
}

// ============================================================
// Matches
function listMatches({ round, fromMs, toMs, status } = {}) {
  const where = []
  const params = []
  if (round) { where.push('m.round = ?'); params.push(round) }
  if (status) { where.push('m.status = ?'); params.push(status) }
  if (fromMs != null) { where.push('m.kick_off_at >= ?'); params.push(fromMs) }
  if (toMs != null) { where.push('m.kick_off_at <= ?'); params.push(toMs) }
  const sql = `
    SELECT m.*,
      t1.name AS team1_name, t1.code AS team1_code,
      t2.name AS team2_name, t2.code AS team2_code
    FROM worldcup_matches m
    JOIN worldcup_teams t1 ON t1.id = m.team1_id
    JOIN worldcup_teams t2 ON t2.id = m.team2_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY m.kick_off_at ASC
  `
  return db().prepare(sql).all(...params)
}

function getMatch(id) {
  return db().prepare(`
    SELECT m.*,
      t1.name AS team1_name, t1.code AS team1_code,
      t2.name AS team2_name, t2.code AS team2_code
    FROM worldcup_matches m
    JOIN worldcup_teams t1 ON t1.id = m.team1_id
    JOIN worldcup_teams t2 ON t2.id = m.team2_id
    WHERE m.id = ?
  `).get(id)
}

function createMatch({ team1Id, team2Id, kickOffAt, round, groupName }) {
  const info = db().prepare(`
    INSERT INTO worldcup_matches (team1_id, team2_id, kick_off_at, round, group_name)
    VALUES (?, ?, ?, ?, ?)
  `).run(team1Id, team2Id, kickOffAt, round, groupName || null)
  return getMatch(info.lastInsertRowid)
}

function updateMatch(id, patch) {
  const fields = []
  const params = []
  const mapping = {
    team1Id: 'team1_id', team2Id: 'team2_id', kickOffAt: 'kick_off_at',
    round: 'round', groupName: 'group_name', status: 'status',
  }
  for (const [k, col] of Object.entries(mapping)) {
    if (patch[k] !== undefined) {
      fields.push(`${col} = ?`)
      params.push(patch[k])
    }
  }
  if (fields.length === 0) return getMatch(id)
  fields.push('updated_at = unixepoch()')
  params.push(id)
  db().prepare(`UPDATE worldcup_matches SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  return getMatch(id)
}

function deleteMatch(id) {
  const database = db()
  const tx = database.transaction(() => {
    database.prepare('DELETE FROM worldcup_notification_log WHERE match_id = ?').run(id)
    database.prepare('DELETE FROM worldcup_matches WHERE id = ?').run(id)
  })
  tx()
}

// Cho scheduler: query match scheduled trong window [fromMs, toMs]
function findUpcomingMatches({ fromMs, toMs }) {
  return db().prepare(`
    SELECT m.*,
      t1.name AS team1_name, t1.code AS team1_code,
      t2.name AS team2_name, t2.code AS team2_code
    FROM worldcup_matches m
    JOIN worldcup_teams t1 ON t1.id = m.team1_id
    JOIN worldcup_teams t2 ON t2.id = m.team2_id
    WHERE m.status = 'scheduled' AND m.kick_off_at BETWEEN ? AND ?
  `).all(fromMs, toMs)
}

// ============================================================
// Guild config
function getGuildConfig(guildId) {
  const row = db().prepare('SELECT * FROM worldcup_guild_config WHERE guild_id = ?').get(guildId)
  if (!row) {
    return {
      guild_id: guildId,
      enabled: 0,
      channel_id: null,
      notify_before_minutes: 30,
      role_ping_id: null,
      timezone: 'Asia/Saigon',
    }
  }
  return row
}

function upsertGuildConfig(guildId, patch) {
  const cur = getGuildConfig(guildId)
  const next = {
    enabled: patch.enabled != null ? (patch.enabled ? 1 : 0) : cur.enabled,
    channel_id: patch.channel_id !== undefined ? patch.channel_id : cur.channel_id,
    notify_before_minutes: patch.notify_before_minutes != null ? patch.notify_before_minutes : cur.notify_before_minutes,
    role_ping_id: patch.role_ping_id !== undefined ? patch.role_ping_id : cur.role_ping_id,
    timezone: patch.timezone || cur.timezone,
  }
  db().prepare(`
    INSERT INTO worldcup_guild_config (guild_id, enabled, channel_id, notify_before_minutes, role_ping_id, timezone, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(guild_id) DO UPDATE SET
      enabled = excluded.enabled,
      channel_id = excluded.channel_id,
      notify_before_minutes = excluded.notify_before_minutes,
      role_ping_id = excluded.role_ping_id,
      timezone = excluded.timezone,
      updated_at = excluded.updated_at
  `).run(guildId, next.enabled, next.channel_id, next.notify_before_minutes, next.role_ping_id, next.timezone)
  return getGuildConfig(guildId)
}

function listEnabledConfigs() {
  return db().prepare('SELECT * FROM worldcup_guild_config WHERE enabled = 1 AND channel_id IS NOT NULL').all()
}

// ============================================================
// Notification log (idempotency)
function hasSentNotification(matchId, guildId) {
  const row = db().prepare('SELECT 1 FROM worldcup_notification_log WHERE match_id = ? AND guild_id = ?').get(matchId, guildId)
  return !!row
}

function markNotificationSent(matchId, guildId, sentAt) {
  db().prepare('INSERT OR IGNORE INTO worldcup_notification_log (match_id, guild_id, sent_at) VALUES (?, ?, ?)')
    .run(matchId, guildId, sentAt || Date.now())
}

module.exports = {
  initWorldcupSchema,
  // teams
  listTeams, getTeam, createTeam, updateTeam, deleteTeam,
  // matches
  listMatches, getMatch, createMatch, updateMatch, deleteMatch, findUpcomingMatches,
  // guild config
  getGuildConfig, upsertGuildConfig, listEnabledConfigs,
  // notification log
  hasSentNotification, markNotificationSent,
}
