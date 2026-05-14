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

    CREATE TABLE IF NOT EXISTS level_up_template (
      guild_id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '🎉 Level Up!',
      description TEXT NOT NULL DEFAULT 'Chúc mừng **{user}** đã đạt **Level {level}**!',
      milestone_description TEXT NOT NULL DEFAULT '🎊 Chúc mừng **{user}** đã đạt **Level {level}** và nhận được **{reward}**!',
      show_tier_field INTEGER NOT NULL DEFAULT 1,
      show_xp_field INTEGER NOT NULL DEFAULT 1,
      show_progress_field INTEGER NOT NULL DEFAULT 1,
      show_role_reward INTEGER NOT NULL DEFAULT 1,
      show_badge_reward INTEGER NOT NULL DEFAULT 1,
      show_badge_image INTEGER NOT NULL DEFAULT 1,
      show_avatar INTEGER NOT NULL DEFAULT 1,
      mention_user INTEGER NOT NULL DEFAULT 1,
      color_mode TEXT NOT NULL DEFAULT 'tier' CHECK(color_mode IN ('tier','custom')),
      custom_color TEXT NOT NULL DEFAULT '#6366f1',
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS silent_members (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT,
      global_name TEXT,
      nickname TEXT,
      avatar TEXT,
      joined_at TEXT,
      scanned_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS member_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('join','leave')),
      occurred_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_member_events_guild_time ON member_events(guild_id, occurred_at DESC);

    -- Counter theo gio (0-23) va weekday (0=CN, 1=T2, ..., 6=T7)
    CREATE TABLE IF NOT EXISTS activity_buckets (
      guild_id TEXT NOT NULL,
      weekday INTEGER NOT NULL,
      hour INTEGER NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, weekday, hour)
    );

    -- Counter theo channel
    CREATE TABLE IF NOT EXISTS channel_stats (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      channel_name TEXT,
      message_count INTEGER NOT NULL DEFAULT 0,
      last_message_at INTEGER,
      PRIMARY KEY (guild_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS mod_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      action_type TEXT NOT NULL CHECK(action_type IN ('kick','ban','unban','mute','unmute')),
      user_id TEXT NOT NULL,
      user_tag TEXT,
      user_avatar TEXT,
      moderator_id TEXT,
      moderator_tag TEXT,
      reason TEXT,
      duration_ms INTEGER,
      expires_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_mod_guild_created ON mod_actions(guild_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mod_user ON mod_actions(guild_id, user_id, action_type);

    CREATE TABLE IF NOT EXISTS temp_bans (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      unban_at INTEGER NOT NULL,
      reason TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (guild_id, user_id)
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
  try { database.exec(`ALTER TABLE guild_settings ADD COLUMN allowed_role_ids TEXT`) } catch (_) {}
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
  const row = getDb()
    .prepare('SELECT * FROM guild_settings WHERE guild_id = ?')
    .get(guildId)
  if (!row) return null
  // Parse JSON array, fallback empty array
  let allowed = []
  try { allowed = row.allowed_role_ids ? JSON.parse(row.allowed_role_ids) : [] } catch (_) { allowed = [] }
  return { ...row, allowed_role_ids: allowed }
}

function upsertSettings(settings) {
  const allowedJson = JSON.stringify(Array.isArray(settings.allowed_role_ids) ? settings.allowed_role_ids : [])
  return getDb()
    .prepare(`
      INSERT INTO guild_settings (guild_id, xp_min, xp_max, cooldown_seconds, level_up_channel_id, allowed_role_ids, updated_at)
      VALUES (@guild_id, @xp_min, @xp_max, @cooldown_seconds, @level_up_channel_id, @allowed_role_ids, unixepoch())
      ON CONFLICT(guild_id) DO UPDATE SET
        xp_min = excluded.xp_min,
        xp_max = excluded.xp_max,
        cooldown_seconds = excluded.cooldown_seconds,
        level_up_channel_id = excluded.level_up_channel_id,
        allowed_role_ids = excluded.allowed_role_ids,
        updated_at = unixepoch()
    `)
    .run({ ...settings, allowed_role_ids: allowedJson })
}

// ============================================================
// Analytics
// ============================================================
function logMemberEvent(guildId, userId, eventType) {
  return getDb()
    .prepare('INSERT INTO member_events (guild_id, user_id, event_type) VALUES (?, ?, ?)')
    .run(guildId, userId, eventType)
}

function incrementActivity(guildId, weekday, hour) {
  return getDb()
    .prepare(`
      INSERT INTO activity_buckets (guild_id, weekday, hour, message_count)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(guild_id, weekday, hour) DO UPDATE SET message_count = message_count + 1
    `)
    .run(guildId, weekday, hour)
}

function incrementChannelStat(guildId, channelId, channelName) {
  const nowSec = Math.floor(Date.now() / 1000)
  return getDb()
    .prepare(`
      INSERT INTO channel_stats (guild_id, channel_id, channel_name, message_count, last_message_at)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(guild_id, channel_id) DO UPDATE SET
        message_count = message_count + 1,
        channel_name = COALESCE(excluded.channel_name, channel_name),
        last_message_at = excluded.last_message_at
    `)
    .run(guildId, channelId, channelName || null, nowSec)
}

// Member growth: join/leave count moi ngay trong N ngay vua qua
function getMemberGrowth(guildId, days = 30) {
  const since = Math.floor(Date.now() / 1000) - days * 86400
  return getDb()
    .prepare(`
      SELECT
        date(occurred_at, 'unixepoch') AS day,
        SUM(CASE WHEN event_type = 'join' THEN 1 ELSE 0 END) AS joins,
        SUM(CASE WHEN event_type = 'leave' THEN 1 ELSE 0 END) AS leaves
      FROM member_events
      WHERE guild_id = ? AND occurred_at >= ?
      GROUP BY day
      ORDER BY day ASC
    `)
    .all(guildId, since)
}

// Heatmap: 7 weekday x 24 hour
function getActivityHeatmap(guildId) {
  return getDb()
    .prepare('SELECT weekday, hour, message_count FROM activity_buckets WHERE guild_id = ?')
    .all(guildId)
}

// Top channels theo message_count
function getTopChannels(guildId, limit = 10) {
  return getDb()
    .prepare(`
      SELECT channel_id, channel_name, message_count, last_message_at
      FROM channel_stats WHERE guild_id = ?
      ORDER BY message_count DESC LIMIT ?
    `)
    .all(guildId, limit)
}

// Inactive members: user co last_message_at < (now - days)
function getInactiveMembers(guildId, days = 7, limit = 100) {
  const threshold = Math.floor(Date.now() / 1000) - days * 86400
  return getDb()
    .prepare(`
      SELECT id, username, global_name, nickname, avatar, xp, level, last_message_at
      FROM users
      WHERE guild_id = ? AND last_message_at IS NOT NULL AND last_message_at < ?
      ORDER BY last_message_at ASC
      LIMIT ?
    `)
    .all(guildId, threshold, limit)
}

// ============================================================
// Silent Members (member trong server chua chat)
// ============================================================
function getSilentMembers(guildId, limit = 500) {
  return getDb()
    .prepare(`
      SELECT * FROM silent_members
      WHERE guild_id = ?
      ORDER BY joined_at DESC NULLS LAST
      LIMIT ?
    `)
    .all(guildId, limit)
}

function countSilentMembers(guildId) {
  return (getDb()
    .prepare('SELECT COUNT(*) as t FROM silent_members WHERE guild_id = ?')
    .get(guildId) || {}).t || 0
}

function getSilentScannedAt(guildId) {
  return (getDb()
    .prepare('SELECT MAX(scanned_at) as t FROM silent_members WHERE guild_id = ?')
    .get(guildId) || {}).t || null
}

// Replace toan bo silent list cho guild (sau khi quet)
function replaceSilentMembers(guildId, members) {
  const tx = getDb().transaction((rows) => {
    getDb().prepare('DELETE FROM silent_members WHERE guild_id = ?').run(guildId)
    const stmt = getDb().prepare(`
      INSERT INTO silent_members (guild_id, user_id, username, global_name, nickname, avatar, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    for (const m of rows) {
      stmt.run(guildId, m.user_id || m.id, m.username || null, m.global_name || null, m.nickname || null, m.avatar || null, m.joined_at || null)
    }
  })
  tx(members)
}

// Xoa 1 user khoi silent list (khi ho bat dau chat)
function removeSilentMember(guildId, userId) {
  return getDb()
    .prepare('DELETE FROM silent_members WHERE guild_id = ? AND user_id = ?')
    .run(guildId, userId)
}

function getAnalyticsSummary(guildId) {
  const db = getDb()
  return {
    total_messages: (db.prepare('SELECT SUM(message_count) as t FROM activity_buckets WHERE guild_id = ?').get(guildId) || {}).t || 0,
    total_channels: (db.prepare('SELECT COUNT(*) as t FROM channel_stats WHERE guild_id = ?').get(guildId) || {}).t || 0,
    total_members: (db.prepare('SELECT COUNT(*) as t FROM users WHERE guild_id = ?').get(guildId) || {}).t || 0,
    joins_30d: (db.prepare(`SELECT COUNT(*) as t FROM member_events WHERE guild_id = ? AND event_type = 'join' AND occurred_at >= ?`).get(guildId, Math.floor(Date.now() / 1000) - 30 * 86400) || {}).t || 0,
    leaves_30d: (db.prepare(`SELECT COUNT(*) as t FROM member_events WHERE guild_id = ? AND event_type = 'leave' AND occurred_at >= ?`).get(guildId, Math.floor(Date.now() / 1000) - 30 * 86400) || {}).t || 0,
  }
}

// ============================================================
// Moderation Actions (log kick/ban/unban/mute/unmute)
// ============================================================
function logModAction(action) {
  return getDb()
    .prepare(`
      INSERT INTO mod_actions (
        guild_id, action_type, user_id, user_tag, user_avatar,
        moderator_id, moderator_tag, reason, duration_ms, expires_at
      ) VALUES (
        @guild_id, @action_type, @user_id, @user_tag, @user_avatar,
        @moderator_id, @moderator_tag, @reason, @duration_ms, @expires_at
      )
    `)
    .run({
      user_tag: null, user_avatar: null,
      moderator_id: null, moderator_tag: null,
      reason: null, duration_ms: null, expires_at: null,
      ...action,
    })
}

function getModActions(guildId, { action_type, search, limit = 100, offset = 0 } = {}) {
  let query = 'SELECT * FROM mod_actions WHERE guild_id = @guild_id'
  const params = { guild_id: guildId, limit, offset }
  if (action_type) {
    query += ' AND action_type = @action_type'
    params.action_type = action_type
  }
  if (search) {
    query += ' AND (user_tag LIKE @search OR user_id LIKE @search OR reason LIKE @search)'
    params.search = `%${search}%`
  }
  query += ' ORDER BY created_at DESC LIMIT @limit OFFSET @offset'
  return getDb().prepare(query).all(params)
}

function countModActions(guildId, { action_type, search } = {}) {
  let query = 'SELECT COUNT(*) as total FROM mod_actions WHERE guild_id = @guild_id'
  const params = { guild_id: guildId }
  if (action_type) { query += ' AND action_type = @action_type'; params.action_type = action_type }
  if (search) {
    query += ' AND (user_tag LIKE @search OR user_id LIKE @search OR reason LIKE @search)'
    params.search = `%${search}%`
  }
  return (getDb().prepare(query).get(params) || {}).total || 0
}

// Tinh user dang BAN (co ban, chua co unban sau do)
function getActiveBans(guildId) {
  return getDb()
    .prepare(`
      SELECT b.* FROM mod_actions b
      WHERE b.guild_id = ? AND b.action_type = 'ban'
        AND NOT EXISTS (
          SELECT 1 FROM mod_actions u
          WHERE u.guild_id = b.guild_id
            AND u.user_id = b.user_id
            AND u.action_type = 'unban'
            AND u.id > b.id
        )
      ORDER BY b.created_at DESC
    `)
    .all(guildId)
}

// ============================================================
// Temp Bans (ban co thoi han)
// ============================================================
function addTempBan(guildId, userId, unbanAt, reason) {
  return getDb()
    .prepare(`
      INSERT INTO temp_bans (guild_id, user_id, unban_at, reason)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET unban_at = excluded.unban_at, reason = excluded.reason
    `)
    .run(guildId, userId, unbanAt, reason || null)
}

function removeTempBan(guildId, userId) {
  return getDb()
    .prepare('DELETE FROM temp_bans WHERE guild_id = ? AND user_id = ?')
    .run(guildId, userId)
}

function getExpiredBans(nowSec) {
  return getDb()
    .prepare('SELECT * FROM temp_bans WHERE unban_at <= ?')
    .all(nowSec)
}

// Helper: check member co quyen su dung bot khong
function memberHasAccess(member, allowedRoleIds) {
  if (!allowedRoleIds || allowedRoleIds.length === 0) return true // open mode
  if (!member || !member.roles) return false
  return allowedRoleIds.some(rid => member.roles.cache.has(rid))
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

// ============================================================
// Level Up Template
// ============================================================
const TEMPLATE_DEFAULTS = {
  title: '🎉 Level Up!',
  description: 'Chúc mừng **{user}** đã đạt **Level {level}**!',
  milestone_description: '🎊 Chúc mừng **{user}** đã đạt **Level {level}** và nhận được **{reward}**!',
  show_tier_field: 1,
  show_xp_field: 1,
  show_progress_field: 1,
  show_role_reward: 1,
  show_badge_reward: 1,
  show_badge_image: 1,
  show_avatar: 1,
  mention_user: 1,
  color_mode: 'tier',
  custom_color: '#6366f1',
}

function getLevelUpTemplate(guildId) {
  const row = getDb()
    .prepare('SELECT * FROM level_up_template WHERE guild_id = ?')
    .get(guildId)
  return row || { guild_id: guildId, ...TEMPLATE_DEFAULTS }
}

function upsertLevelUpTemplate(template) {
  const merged = { ...TEMPLATE_DEFAULTS, ...template }
  return getDb()
    .prepare(`
      INSERT INTO level_up_template (
        guild_id, title, description, milestone_description,
        show_tier_field, show_xp_field, show_progress_field,
        show_role_reward, show_badge_reward, show_badge_image,
        show_avatar, mention_user, color_mode, custom_color, updated_at
      ) VALUES (
        @guild_id, @title, @description, @milestone_description,
        @show_tier_field, @show_xp_field, @show_progress_field,
        @show_role_reward, @show_badge_reward, @show_badge_image,
        @show_avatar, @mention_user, @color_mode, @custom_color, unixepoch()
      )
      ON CONFLICT(guild_id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        milestone_description = excluded.milestone_description,
        show_tier_field = excluded.show_tier_field,
        show_xp_field = excluded.show_xp_field,
        show_progress_field = excluded.show_progress_field,
        show_role_reward = excluded.show_role_reward,
        show_badge_reward = excluded.show_badge_reward,
        show_badge_image = excluded.show_badge_image,
        show_avatar = excluded.show_avatar,
        mention_user = excluded.mention_user,
        color_mode = excluded.color_mode,
        custom_color = excluded.custom_color,
        updated_at = unixepoch()
    `)
    .run(merged)
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
  getLevelUpTemplate,
  upsertLevelUpTemplate,
  memberHasAccess,
  addTempBan,
  removeTempBan,
  getExpiredBans,
  logModAction,
  getModActions,
  countModActions,
  getActiveBans,
  logMemberEvent,
  incrementActivity,
  incrementChannelStat,
  getMemberGrowth,
  getActivityHeatmap,
  getTopChannels,
  getInactiveMembers,
  getAnalyticsSummary,
  getSilentMembers,
  countSilentMembers,
  getSilentScannedAt,
  replaceSilentMembers,
  removeSilentMember,
}
