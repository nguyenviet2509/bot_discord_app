const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
const DB_PATH = path.join(DATA_DIR, 'database.sqlite')

let db

function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

function initDb() {
  const database = getDb()
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 0,
      last_message_at INTEGER,
      updated_at INTEGER DEFAULT (unixepoch()),
      username TEXT,
      avatar TEXT,
      nickname TEXT,
      global_name TEXT,
      PRIMARY KEY (id, guild_id)
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      level_required INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('role', 'badge')),
      role_id TEXT,
      badge_url TEXT,
      badge_name TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      xp_min INTEGER NOT NULL DEFAULT 15,
      xp_max INTEGER NOT NULL DEFAULT 25,
      cooldown_seconds INTEGER NOT NULL DEFAULT 60,
      level_up_channel_id TEXT,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      channel_name TEXT,
      user_id TEXT NOT NULL,
      url TEXT NOT NULL,
      message_id TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );
  `)
  // Safe migration for existing databases
  try { database.exec(`ALTER TABLE users ADD COLUMN username TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE users ADD COLUMN avatar TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE users ADD COLUMN nickname TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE users ADD COLUMN global_name TEXT`) } catch (_) {}
  return database
}

function getUser(userId, guildId) {
  return getDb()
    .prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?')
    .get(userId, guildId)
}

function upsertUser(user) {
  return getDb()
    .prepare(`
      INSERT INTO users (id, guild_id, xp, level, last_message_at, username, avatar, nickname, global_name, updated_at)
      VALUES (@id, @guild_id, @xp, @level, @last_message_at, @username, @avatar, @nickname, @global_name, unixepoch())
      ON CONFLICT(id, guild_id) DO UPDATE SET
        xp = excluded.xp,
        level = excluded.level,
        last_message_at = excluded.last_message_at,
        username = COALESCE(excluded.username, username),
        avatar = COALESCE(excluded.avatar, avatar),
        nickname = COALESCE(excluded.nickname, nickname),
        global_name = COALESCE(excluded.global_name, global_name),
        updated_at = unixepoch()
    `)
    .run({ username: null, avatar: null, nickname: null, global_name: null, ...user })
}

function getRewards(guildId) {
  return getDb()
    .prepare('SELECT * FROM rewards WHERE guild_id = ? ORDER BY level_required ASC')
    .all(guildId)
}

function getRewardById(id, guildId) {
  return getDb()
    .prepare('SELECT * FROM rewards WHERE id = ? AND guild_id = ?')
    .get(id, guildId)
}

function upsertReward(reward) {
  if (reward.id) {
    return getDb()
      .prepare(`
        UPDATE rewards SET
          level_required = @level_required,
          type = @type,
          role_id = @role_id,
          badge_url = @badge_url,
          badge_name = @badge_name
        WHERE id = @id AND guild_id = @guild_id
      `)
      .run(reward)
  }
  return getDb()
    .prepare(`
      INSERT INTO rewards (guild_id, level_required, type, role_id, badge_url, badge_name)
      VALUES (@guild_id, @level_required, @type, @role_id, @badge_url, @badge_name)
    `)
    .run(reward)
}

function deleteReward(id, guildId) {
  return getDb()
    .prepare('DELETE FROM rewards WHERE id = ? AND guild_id = ?')
    .run(id, guildId)
}

function getSettings(guildId) {
  return getDb()
    .prepare('SELECT * FROM guild_settings WHERE guild_id = ?')
    .get(guildId)
}

function upsertSettings(settings) {
  return getDb()
    .prepare(`
      INSERT INTO guild_settings (guild_id, xp_min, xp_max, cooldown_seconds, level_up_channel_id, updated_at)
      VALUES (@guild_id, @xp_min, @xp_max, @cooldown_seconds, @level_up_channel_id, unixepoch())
      ON CONFLICT(guild_id) DO UPDATE SET
        xp_min = excluded.xp_min,
        xp_max = excluded.xp_max,
        cooldown_seconds = excluded.cooldown_seconds,
        level_up_channel_id = excluded.level_up_channel_id,
        updated_at = unixepoch()
    `)
    .run(settings)
}

function getUserRank(userId, guildId) {
  const result = getDb()
    .prepare(`
      SELECT COUNT(*) + 1 AS rank FROM users
      WHERE guild_id = ? AND xp > (
        SELECT xp FROM users WHERE id = ? AND guild_id = ?
      )
    `)
    .get(guildId, userId, guildId)
  return result ? result.rank : 1
}

function getLeaderboard(guildId, limit = 10) {
  return getDb()
    .prepare('SELECT * FROM users WHERE guild_id = ? ORDER BY xp DESC LIMIT ?')
    .all(guildId, limit)
}

function getAllUsers(guildId) {
  return getDb()
    .prepare('SELECT * FROM users WHERE guild_id = ? ORDER BY xp DESC')
    .all(guildId)
}

function resetUserXp(userId, guildId) {
  return getDb()
    .prepare(`
      UPDATE users SET xp = 0, level = 0, last_message_at = NULL, updated_at = unixepoch()
      WHERE id = ? AND guild_id = ?
    `)
    .run(userId, guildId)
}

function deleteUser(userId, guildId) {
  return getDb()
    .prepare('DELETE FROM users WHERE id = ? AND guild_id = ?')
    .run(userId, guildId)
}

// ============================================================
// Links
// ============================================================
function saveLink({ guild_id, channel_id, channel_name, user_id, url, message_id }) {
  return getDb()
    .prepare(`
      INSERT INTO links (guild_id, channel_id, channel_name, user_id, url, message_id)
      VALUES (@guild_id, @channel_id, @channel_name, @user_id, @url, @message_id)
    `)
    .run({ guild_id, channel_id, channel_name: channel_name || null, user_id, url, message_id: message_id || null })
}

function getLinks(guildId, { search = '', channel_id = '', limit = 50, offset = 0 } = {}) {
  let query = 'SELECT * FROM links WHERE guild_id = @guild_id'
  const params = { guild_id: guildId, limit, offset }
  if (channel_id) {
    query += ' AND channel_id = @channel_id'
    params.channel_id = channel_id
  }
  if (search) {
    query += ' AND url LIKE @search'
    params.search = `%${search}%`
  }
  query += ' ORDER BY created_at DESC LIMIT @limit OFFSET @offset'
  return getDb().prepare(query).all(params)
}

function countLinks(guildId, { search = '', channel_id = '' } = {}) {
  let query = 'SELECT COUNT(*) as total FROM links WHERE guild_id = @guild_id'
  const params = { guild_id: guildId }
  if (channel_id) {
    query += ' AND channel_id = @channel_id'
    params.channel_id = channel_id
  }
  if (search) {
    query += ' AND url LIKE @search'
    params.search = `%${search}%`
  }
  return (getDb().prepare(query).get(params) || {}).total || 0
}

function deleteLink(id, guildId) {
  return getDb()
    .prepare('DELETE FROM links WHERE id = ? AND guild_id = ?')
    .run(id, guildId)
}

function getChannelsWithLinks(guildId) {
  return getDb()
    .prepare('SELECT DISTINCT channel_id, channel_name FROM links WHERE guild_id = ? ORDER BY channel_name ASC')
    .all(guildId)
}

module.exports = {
  initDb,
  getUser,
  upsertUser,
  getRewards,
  getRewardById,
  upsertReward,
  deleteReward,
  getSettings,
  upsertSettings,
  getUserRank,
  getLeaderboard,
  getAllUsers,
  resetUserXp,
  deleteUser,
  saveLink,
  getLinks,
  countLinks,
  deleteLink,
  getChannelsWithLinks,
}
