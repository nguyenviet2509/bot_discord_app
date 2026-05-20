// DB schema + helpers cho module "Quan ly Events" (custom bot events).
// Dung chung SQLite connection voi shared/db.js (lay qua getDb()).
//
// 2 bang:
//   - event_groups: nhom events (folder-style), per-guild, sort_order
//   - events: event chinh, group_id nullable (NULL = "Chua phan nhom")

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS event_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    group_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    status INTEGER NOT NULL DEFAULT 0,
    start_at INTEGER,
    end_at INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_events_guild_group ON events(guild_id, group_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_event_groups_guild ON event_groups(guild_id, sort_order);
`

// Type built-in luon co trong dropdown suggestions
const BUILTIN_TYPES = ['giveaway', 'raffle', 'trivia']
// Regex chap nhan type: a-z, 0-9, dau gach duoi, dau gach ngang, 1-30 ky tu
const TYPE_REGEX = /^[a-z0-9_-]{1,30}$/i

function initEventsSchema(database) {
  database.exec(SCHEMA_SQL)
}

// Lazy resolver tranh circular require
function db() {
  return require('./db').getDb()
}

// ============================================================
// Groups
// ============================================================

// Tra ve [{id, name, sort_order, event_count}]
function getGroups(guildId) {
  return db()
    .prepare(`
      SELECT g.id, g.name, g.sort_order,
             (SELECT COUNT(*) FROM events e WHERE e.guild_id = g.guild_id AND e.group_id = g.id) AS event_count
      FROM event_groups g
      WHERE g.guild_id = ?
      ORDER BY g.sort_order ASC, g.id ASC
    `)
    .all(guildId)
}

function createGroup(guildId, name) {
  // Sort_order moi = max + 1 de auto-append cuoi list
  const maxRow = db()
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM event_groups WHERE guild_id = ?')
    .get(guildId)
  const nextOrder = (maxRow?.m ?? -1) + 1
  return db()
    .prepare('INSERT INTO event_groups (guild_id, name, sort_order) VALUES (?, ?, ?)')
    .run(guildId, name, nextOrder)
}

function updateGroup(id, guildId, name) {
  return db()
    .prepare('UPDATE event_groups SET name = ? WHERE id = ? AND guild_id = ?')
    .run(name, id, guildId)
}

function deleteGroup(id, guildId) {
  const database = db()
  const tx = database.transaction(() => {
    // Detach events thay vi xoa
    database.prepare('UPDATE events SET group_id = NULL, updated_at = unixepoch() WHERE group_id = ? AND guild_id = ?').run(id, guildId)
    database.prepare('DELETE FROM event_groups WHERE id = ? AND guild_id = ?').run(id, guildId)
  })
  tx()
}

// Reorder groups: orderedIds = mang id theo thu tu moi
function reorderGroups(guildId, orderedIds) {
  const database = db()
  const stmt = database.prepare('UPDATE event_groups SET sort_order = ? WHERE id = ? AND guild_id = ?')
  const tx = database.transaction(() => {
    orderedIds.forEach((id, idx) => stmt.run(idx, id, guildId))
  })
  tx()
}

// ============================================================
// Events
// ============================================================

// List events trong 1 group co phan trang.
// groupId: number hoac null (cho "Chua phan nhom")
function listEvents(guildId, groupId, page = 1, limit = 10) {
  const offset = Math.max(0, (page - 1) * limit)
  const isNull = groupId === null || groupId === undefined
  const baseWhere = isNull
    ? 'guild_id = ? AND group_id IS NULL'
    : 'guild_id = ? AND group_id = ?'
  const params = isNull ? [guildId] : [guildId, groupId]

  const items = db()
    .prepare(`SELECT * FROM events WHERE ${baseWhere} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset)
  const totalRow = db()
    .prepare(`SELECT COUNT(*) AS t FROM events WHERE ${baseWhere}`)
    .get(...params)
  return { items, total: totalRow?.t || 0, page, limit }
}

function getEventById(id, guildId) {
  return db().prepare('SELECT * FROM events WHERE id = ? AND guild_id = ?').get(id, guildId)
}

function createEvent({ guild_id, group_id, name, description, type, status, start_at, end_at }) {
  // Sort_order = max trong group dich + 1
  const isNull = group_id === null || group_id === undefined
  const maxRow = isNull
    ? db().prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM events WHERE guild_id = ? AND group_id IS NULL').get(guild_id)
    : db().prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM events WHERE guild_id = ? AND group_id = ?').get(guild_id, group_id)
  const nextOrder = (maxRow?.m ?? -1) + 1
  return db()
    .prepare(`
      INSERT INTO events (guild_id, group_id, name, description, type, status, start_at, end_at, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      guild_id,
      isNull ? null : Number(group_id),
      name,
      description || null,
      type,
      status ? 1 : 0,
      start_at || null,
      end_at || null,
      nextOrder
    )
}

// Partial update: chi update field duoc cung cap (!= undefined)
function updateEvent(id, guildId, fields) {
  const sets = []
  const params = { id, guild_id: guildId }
  if (fields.name !== undefined)        { sets.push('name = @name'); params.name = fields.name }
  if (fields.description !== undefined) { sets.push('description = @description'); params.description = fields.description || null }
  if (fields.type !== undefined)        { sets.push('type = @type'); params.type = fields.type }
  if (fields.status !== undefined)      { sets.push('status = @status'); params.status = fields.status ? 1 : 0 }
  if (fields.start_at !== undefined)    { sets.push('start_at = @start_at'); params.start_at = fields.start_at || null }
  if (fields.end_at !== undefined)      { sets.push('end_at = @end_at'); params.end_at = fields.end_at || null }
  if (fields.group_id !== undefined)    { sets.push('group_id = @group_id'); params.group_id = (fields.group_id === null || fields.group_id === '') ? null : Number(fields.group_id) }
  if (fields.sort_order !== undefined)  { sets.push('sort_order = @sort_order'); params.sort_order = Number(fields.sort_order) }
  if (sets.length === 0) return { changes: 0 }
  sets.push('updated_at = unixepoch()')
  return db()
    .prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = @id AND guild_id = @guild_id`)
    .run(params)
}

function deleteEvent(id, guildId) {
  return db().prepare('DELETE FROM events WHERE id = ? AND guild_id = ?').run(id, guildId)
}

// Reorder: updates = [{id, group_id, sort_order}, ...] — atomic transaction
function reorderEvents(guildId, updates) {
  const database = db()
  const stmt = database.prepare(`
    UPDATE events
    SET group_id = @group_id, sort_order = @sort_order, updated_at = unixepoch()
    WHERE id = @id AND guild_id = @guild_id
  `)
  const tx = database.transaction(() => {
    updates.forEach((u) => {
      stmt.run({
        id: Number(u.id),
        guild_id: guildId,
        group_id: (u.group_id === null || u.group_id === undefined || u.group_id === '') ? null : Number(u.group_id),
        sort_order: Number(u.sort_order) || 0,
      })
    })
  })
  tx()
}

// Distinct types trong 1 group + builtin → suggestions cho combobox
function listTypesForGroup(guildId, groupId) {
  const isNull = groupId === null || groupId === undefined
  const customTypes = isNull
    ? db().prepare('SELECT DISTINCT type FROM events WHERE guild_id = ? AND group_id IS NULL').all(guildId)
    : db().prepare('SELECT DISTINCT type FROM events WHERE guild_id = ? AND group_id = ?').all(guildId, groupId)
  const custom = customTypes.map(r => r.type).filter(Boolean)
  return [...new Set([...BUILTIN_TYPES, ...custom])]
}

module.exports = {
  initEventsSchema,
  BUILTIN_TYPES,
  TYPE_REGEX,
  // Groups
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  reorderGroups,
  // Events
  listEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  reorderEvents,
  listTypesForGroup,
}
