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

// Seed danh sach doi du Worldcup 2026 (48 doi theo 6 lien doan).
// AFC 9 + CAF 10 + CONCACAF 6 + CONMEBOL 6 + OFC 1 + UEFA 16
const SEED_TEAMS = [
  // AFC (chau A)
  { code: 'AUS', name: 'Úc' }, { code: 'IRN', name: 'Iran' },
  { code: 'IRQ', name: 'Iraq' }, { code: 'JPN', name: 'Nhật Bản' },
  { code: 'JOR', name: 'Jordan' }, { code: 'KOR', name: 'Hàn Quốc' },
  { code: 'KSA', name: 'Saudi Arabia' }, { code: 'QAT', name: 'Qatar' },
  { code: 'UZB', name: 'Uzbekistan' },
  // CAF (chau Phi)
  { code: 'ALG', name: 'Algeria' }, { code: 'CIV', name: 'Bờ Biển Ngà' },
  { code: 'CPV', name: 'Cabo Verde' }, { code: 'CGO', name: 'Congo' },
  { code: 'EGY', name: 'Ai Cập' }, { code: 'GHA', name: 'Ghana' },
  { code: 'MAR', name: 'Morocco' }, { code: 'RSA', name: 'Nam Phi' },
  { code: 'SEN', name: 'Senegal' }, { code: 'TUN', name: 'Tunisia' },
  // CONCACAF (Bac, Trung My va Caribe)
  { code: 'CAN', name: 'Canada' }, { code: 'USA', name: 'Mỹ' },
  { code: 'MEX', name: 'Mexico' }, { code: 'CUW', name: 'Curaçao' },
  { code: 'HAI', name: 'Haiti' }, { code: 'PAN', name: 'Panama' },
  // CONMEBOL (Nam My)
  { code: 'ARG', name: 'Argentina' }, { code: 'BRA', name: 'Brazil' },
  { code: 'COL', name: 'Colombia' }, { code: 'ECU', name: 'Ecuador' },
  { code: 'PAR', name: 'Paraguay' }, { code: 'URU', name: 'Uruguay' },
  // OFC (chau Dai Duong)
  { code: 'NZL', name: 'New Zealand' },
  // UEFA (chau Au)
  { code: 'AUT', name: 'Áo' }, { code: 'BEL', name: 'Bỉ' },
  { code: 'BIH', name: 'Bosna và Herzegovina' }, { code: 'CRO', name: 'Croatia' },
  { code: 'CZE', name: 'Czech' }, { code: 'ENG', name: 'Anh' },
  { code: 'FRA', name: 'Pháp' }, { code: 'GER', name: 'Đức' },
  { code: 'NED', name: 'Hà Lan' }, { code: 'NOR', name: 'Na Uy' },
  { code: 'POR', name: 'Bồ Đào Nha' }, { code: 'SCO', name: 'Scotland' },
  { code: 'ESP', name: 'Tây Ban Nha' }, { code: 'SWE', name: 'Thụy Điển' },
  { code: 'SUI', name: 'Thụy Sĩ' }, { code: 'TUR', name: 'Thổ Nhĩ Kỳ' },
]

function initWorldcupSchema(database) {
  database.exec(SCHEMA_SQL)

  const currentCount = database.prepare('SELECT COUNT(*) AS c FROM worldcup_teams').get().c
  const seedCodes = new Set(SEED_TEAMS.map(t => t.code))

  // Truong hop 1: chua co data -> seed lan dau
  if (currentCount === 0) {
    bulkInsertTeams(database, SEED_TEAMS)
    console.log(`[Worldcup] Seeded ${SEED_TEAMS.length} teams`)
    return
  }

  // Truong hop 2: da co data -> kiem tra co can refresh list khong
  const existingCodes = new Set(
    database.prepare('SELECT code FROM worldcup_teams').all().map(r => r.code)
  )
  const sameSet =
    existingCodes.size === seedCodes.size &&
    [...seedCodes].every(c => existingCodes.has(c))

  if (sameSet) return // da match seed moi nhat

  // Co the cap nhat ten doi (UPSERT theo code) + them doi moi
  const upsert = database.prepare(`
    INSERT INTO worldcup_teams (code, name) VALUES (?, ?)
    ON CONFLICT(code) DO UPDATE SET name = excluded.name
  `)
  const txUpsert = database.transaction((rows) => {
    for (const r of rows) upsert.run(r.code, r.name)
  })
  txUpsert(SEED_TEAMS)

  // Xoa doi cu khong nam trong seed mo i — chi xoa neu khong co match reference
  const stale = [...existingCodes].filter(c => !seedCodes.has(c))
  if (stale.length > 0) {
    const checkRef = database.prepare(`
      SELECT COUNT(*) AS c FROM worldcup_matches m
      JOIN worldcup_teams t ON t.id = m.team1_id OR t.id = m.team2_id
      WHERE t.code = ?
    `)
    const delTeam = database.prepare('DELETE FROM worldcup_teams WHERE code = ?')
    let removed = 0
    for (const code of stale) {
      if (checkRef.get(code).c === 0) {
        delTeam.run(code)
        removed++
      }
    }
    console.log(`[Worldcup] Updated team list (added/renamed via upsert, removed ${removed} stale teams)`)
  } else {
    console.log('[Worldcup] Team list refreshed (added new teams, renamed existing)')
  }
}

function bulkInsertTeams(database, rows) {
  const stmt = database.prepare('INSERT INTO worldcup_teams (code, name) VALUES (?, ?)')
  const tx = database.transaction((items) => {
    for (const r of items) stmt.run(r.code, r.name)
  })
  tx(rows)
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

// Bulk insert nhieu match trong 1 transaction. Bo qua duplicate (same teams + same kickOffAt).
function bulkCreateMatches(rows) {
  const database = db()
  const insert = database.prepare(`
    INSERT INTO worldcup_matches (team1_id, team2_id, kick_off_at, round, group_name)
    VALUES (?, ?, ?, ?, ?)
  `)
  const findDup = database.prepare(`
    SELECT id FROM worldcup_matches
    WHERE kick_off_at = ?
      AND ((team1_id = ? AND team2_id = ?) OR (team1_id = ? AND team2_id = ?))
  `)
  let inserted = 0, skipped = 0
  const tx = database.transaction(() => {
    for (const r of rows) {
      const dup = findDup.get(r.kickOffAt, r.team1Id, r.team2Id, r.team2Id, r.team1Id)
      if (dup) { skipped++; continue }
      insert.run(r.team1Id, r.team2Id, r.kickOffAt, r.round, r.groupName || null)
      inserted++
    }
  })
  tx()
  return { inserted, skipped }
}

// Lookup nhanh team id theo code, dung cho seed script
function getTeamIdByCode(code) {
  const row = db().prepare('SELECT id FROM worldcup_teams WHERE code = ?').get(code)
  return row ? row.id : null
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

// ============================================================
// Reset/wipe: xoa toan bo matches + log + reset config (giu teams seed).
// Tra ve so luong da xoa de UI thong bao.
function wipeAllData() {
  const database = db()
  const tx = database.transaction(() => {
    const matchCount = database.prepare('SELECT COUNT(*) AS c FROM worldcup_matches').get().c
    const logCount = database.prepare('SELECT COUNT(*) AS c FROM worldcup_notification_log').get().c
    const cfgCount = database.prepare('SELECT COUNT(*) AS c FROM worldcup_guild_config').get().c
    database.prepare('DELETE FROM worldcup_notification_log').run()
    database.prepare('DELETE FROM worldcup_matches').run()
    database.prepare('DELETE FROM worldcup_guild_config').run()
    return { matches: matchCount, logs: logCount, configs: cfgCount }
  })
  return tx()
}

module.exports = {
  initWorldcupSchema,
  // teams
  listTeams, getTeam, createTeam, updateTeam, deleteTeam,
  // matches
  listMatches, getMatch, createMatch, updateMatch, deleteMatch, findUpcomingMatches,
  bulkCreateMatches, getTeamIdByCode,
  // guild config
  getGuildConfig, upsertGuildConfig, listEnabledConfigs,
  // notification log
  hasSentNotification, markNotificationSent,
  // admin
  wipeAllData,
}
