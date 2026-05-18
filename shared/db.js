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
      message_count INTEGER NOT NULL DEFAULT 0,
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
      level_up_reply_channel_id TEXT,
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

    CREATE TABLE IF NOT EXISTS welcome_template (
      guild_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      message TEXT NOT NULL DEFAULT 'Chào mừng {user} đã tham gia server! 🎉 Hãy giới thiệu bản thân và làm quen với mọi người nhé.',
      image_url TEXT,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS scheduled_message_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      name TEXT,
      content TEXT,
      image_url TEXT,
      interval_minutes INTEGER NOT NULL DEFAULT 180,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_sent_at INTEGER,
      group_id INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
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

    -- Bai dang cho duyet (post approval flow)
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_tag TEXT,
      author_avatar TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      price TEXT,
      contact TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','deleted')),
      review_message_id TEXT,
      public_thread_id TEXT,
      approver_id TEXT,
      approver_tag TEXT,
      reject_reason TEXT,
      created_at INTEGER NOT NULL,
      reviewed_at INTEGER,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_posts_guild_status ON posts(guild_id, status);
    CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(guild_id, author_id);

    -- Vinh danh Top 3 (Hall of Fame)
    CREATE TABLE IF NOT EXISTS honor_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT,
      title TEXT NOT NULL,
      banner_url TEXT,
      user1_id TEXT NOT NULL,
      user1_reason TEXT NOT NULL,
      user2_id TEXT NOT NULL,
      user2_reason TEXT NOT NULL,
      user3_id TEXT NOT NULL,
      user3_reason TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_honor_history_guild ON honor_history(guild_id, created_at DESC);

    -- Cau hinh vinh danh: role duoc phep + channel mac dinh
    CREATE TABLE IF NOT EXISTS honor_settings (
      guild_id TEXT PRIMARY KEY,
      allowed_role_ids TEXT NOT NULL DEFAULT '[]',
      default_channel_id TEXT,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    -- Vinh danh team (1-10 thanh vien) — Team Roster layout
    CREATE TABLE IF NOT EXISTS honor_team_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT,
      title TEXT NOT NULL,
      team_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      banner_url TEXT,
      member_ids TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_honor_team_guild ON honor_team_history(guild_id, created_at DESC);
  `)
  // Safe migration for existing databases
  try { database.exec(`ALTER TABLE users ADD COLUMN username TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE users ADD COLUMN avatar TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE users ADD COLUMN nickname TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE users ADD COLUMN global_name TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE users ADD COLUMN flair_enabled INTEGER DEFAULT 1`) } catch (_) {}
  try { database.exec(`ALTER TABLE users ADD COLUMN message_count INTEGER NOT NULL DEFAULT 0`) } catch (_) {}
  // Tier badge overrides per-guild per-tier
  // mode='emoji' -> badge la Unicode emoji, gan vao nickname
  // mode='role'  -> role_id la Discord role co icon, bot assign role khi member len tier
  database.exec(`
    CREATE TABLE IF NOT EXISTS guild_tier_badges (
      guild_id TEXT NOT NULL,
      tier_min_level INTEGER NOT NULL,
      badge TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (guild_id, tier_min_level)
    );
  `)
  try { database.exec(`ALTER TABLE guild_tier_badges ADD COLUMN mode TEXT NOT NULL DEFAULT 'emoji'`) } catch (_) {}
  try { database.exec(`ALTER TABLE guild_tier_badges ADD COLUMN role_id TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE guild_tier_badges ADD COLUMN icon_url TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE guild_settings ADD COLUMN allowed_role_ids TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE guild_settings ADD COLUMN level_up_reply_channel_id TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE scheduled_messages ADD COLUMN use_embed INTEGER NOT NULL DEFAULT 0`) } catch (_) {}
  try { database.exec(`ALTER TABLE scheduled_messages ADD COLUMN embed_title TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE scheduled_messages ADD COLUMN embed_color TEXT DEFAULT '#6366f1'`) } catch (_) {}
  try { database.exec(`ALTER TABLE scheduled_messages ADD COLUMN group_id INTEGER`) } catch (_) {}
  try { database.exec(`ALTER TABLE scheduled_messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'`) } catch (_) {}
  try { database.exec(`ALTER TABLE scheduled_messages ADD COLUMN schedule_time TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE scheduled_messages ADD COLUMN schedule_weekday INTEGER`) } catch (_) {}
  try { database.exec(`ALTER TABLE scheduled_messages ADD COLUMN start_time TEXT`) } catch (_) {}
  // Post approval flow settings
  try { database.exec(`ALTER TABLE guild_settings ADD COLUMN post_entry_channel_id TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE guild_settings ADD COLUMN review_channel_id TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE guild_settings ADD COLUMN public_forum_id TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE guild_settings ADD COLUMN post_admin_role_ids TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE posts ADD COLUMN image_url TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE welcome_template ADD COLUMN image_url TEXT`) } catch (_) {}

  // Honor: custom emoji overrides (Discord server emoji `<:name:id>` hoac fallback unicode)
  try { database.exec(`ALTER TABLE honor_settings ADD COLUMN gold_emoji TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE honor_settings ADD COLUMN silver_emoji TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE honor_settings ADD COLUMN bronze_emoji TEXT`) } catch (_) {}
  try { database.exec(`ALTER TABLE honor_settings ADD COLUMN last_banner_url TEXT`) } catch (_) {}

  // Schema cho module system & mini-game PvP (tach file rieng)
  require('./db-mini-game').initMiniGameSchema(database)

  // Schema cho module Auto-Mod Lite (tach file rieng)
  require('./db-automod').initAutomodSchema(database)

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
  let postAdminRoles = []
  try { postAdminRoles = row.post_admin_role_ids ? JSON.parse(row.post_admin_role_ids) : [] } catch (_) { postAdminRoles = [] }
  return { ...row, allowed_role_ids: allowed, post_admin_role_ids: postAdminRoles }
}

// Update post-related settings (KISS: dedicated function, khong dung upsertSettings de tranh dung cham fields cu)
function updatePostSettings(guildId, fields) {
  const db = getDb()
  // Ensure row exists
  db.prepare(`INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)`).run(guildId)
  const sets = []
  const params = { guild_id: guildId }
  if (fields.post_entry_channel_id !== undefined) { sets.push('post_entry_channel_id = @post_entry_channel_id'); params.post_entry_channel_id = fields.post_entry_channel_id }
  if (fields.review_channel_id !== undefined)     { sets.push('review_channel_id = @review_channel_id'); params.review_channel_id = fields.review_channel_id }
  if (fields.public_forum_id !== undefined)       { sets.push('public_forum_id = @public_forum_id'); params.public_forum_id = fields.public_forum_id }
  if (fields.post_admin_role_ids !== undefined) {
    sets.push('post_admin_role_ids = @post_admin_role_ids')
    params.post_admin_role_ids = JSON.stringify(Array.isArray(fields.post_admin_role_ids) ? fields.post_admin_role_ids : [])
  }
  if (sets.length === 0) return
  sets.push('updated_at = unixepoch()')
  db.prepare(`UPDATE guild_settings SET ${sets.join(', ')} WHERE guild_id = @guild_id`).run(params)
}

function upsertSettings(settings) {
  const allowedJson = JSON.stringify(Array.isArray(settings.allowed_role_ids) ? settings.allowed_role_ids : [])
  return getDb()
    .prepare(`
      INSERT INTO guild_settings (guild_id, xp_min, xp_max, cooldown_seconds, level_up_channel_id, level_up_reply_channel_id, allowed_role_ids, updated_at)
      VALUES (@guild_id, @xp_min, @xp_max, @cooldown_seconds, @level_up_channel_id, @level_up_reply_channel_id, @allowed_role_ids, unixepoch())
      ON CONFLICT(guild_id) DO UPDATE SET
        xp_min = excluded.xp_min,
        xp_max = excluded.xp_max,
        cooldown_seconds = excluded.cooldown_seconds,
        level_up_channel_id = excluded.level_up_channel_id,
        level_up_reply_channel_id = excluded.level_up_reply_channel_id,
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
// Scheduled Messages (auto-send theo interval)
// ============================================================
function getScheduledMessages(guildId) {
  return getDb()
    .prepare('SELECT * FROM scheduled_messages WHERE guild_id = ? ORDER BY id ASC')
    .all(guildId)
}

function getScheduledMessageById(id, guildId) {
  return getDb()
    .prepare('SELECT * FROM scheduled_messages WHERE id = ? AND guild_id = ?')
    .get(id, guildId)
}

function createScheduledMessage({ guild_id, channel_id, name, content, image_url, interval_minutes, enabled, use_embed, embed_title, embed_color, group_id, kind, schedule_time, schedule_weekday, start_time }) {
  return getDb()
    .prepare(`
      INSERT INTO scheduled_messages (guild_id, channel_id, name, content, image_url, interval_minutes, enabled, use_embed, embed_title, embed_color, group_id, kind, schedule_time, schedule_weekday, start_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      guild_id, channel_id, name || null, content || null, image_url || null,
      interval_minutes || 180, enabled ? 1 : 0,
      use_embed ? 1 : 0, embed_title || null, embed_color || '#6366f1',
      group_id || null,
      kind === 'leaderboard' ? 'leaderboard' : 'text',
      schedule_time || null,
      (schedule_weekday === null || schedule_weekday === undefined || schedule_weekday === '') ? null : Number(schedule_weekday),
      start_time || null
    )
}

function updateScheduledMessage(id, { channel_id, name, content, image_url, interval_minutes, enabled, use_embed, embed_title, embed_color, group_id, kind, schedule_time, schedule_weekday, start_time }) {
  // group_id / schedule_time / schedule_weekday: explicit null = clear; undefined = keep current
  return getDb()
    .prepare(`
      UPDATE scheduled_messages SET
        channel_id = COALESCE(@channel_id, channel_id),
        name = COALESCE(@name, name),
        content = COALESCE(@content, content),
        image_url = COALESCE(@image_url, image_url),
        interval_minutes = COALESCE(@interval_minutes, interval_minutes),
        enabled = COALESCE(@enabled, enabled),
        use_embed = COALESCE(@use_embed, use_embed),
        embed_title = COALESCE(@embed_title, embed_title),
        embed_color = COALESCE(@embed_color, embed_color),
        group_id = CASE WHEN @group_id_set = 1 THEN @group_id ELSE group_id END,
        kind = COALESCE(@kind, kind),
        schedule_time = CASE WHEN @schedule_time_set = 1 THEN @schedule_time ELSE schedule_time END,
        schedule_weekday = CASE WHEN @schedule_weekday_set = 1 THEN @schedule_weekday ELSE schedule_weekday END,
        start_time = CASE WHEN @start_time_set = 1 THEN @start_time ELSE start_time END
      WHERE id = @id
    `)
    .run({
      id,
      channel_id: channel_id ?? null,
      name: name ?? null,
      content: content ?? null,
      image_url: image_url ?? null,
      interval_minutes: interval_minutes ?? null,
      enabled: enabled === undefined ? null : (enabled ? 1 : 0),
      use_embed: use_embed === undefined ? null : (use_embed ? 1 : 0),
      embed_title: embed_title ?? null,
      embed_color: embed_color ?? null,
      group_id_set: group_id === undefined ? 0 : 1,
      group_id: group_id || null,
      kind: kind === undefined ? null : (kind === 'leaderboard' ? 'leaderboard' : 'text'),
      schedule_time_set: schedule_time === undefined ? 0 : 1,
      schedule_time: schedule_time || null,
      schedule_weekday_set: schedule_weekday === undefined ? 0 : 1,
      schedule_weekday: (schedule_weekday === null || schedule_weekday === '' || schedule_weekday === undefined) ? null : Number(schedule_weekday),
      start_time_set: start_time === undefined ? 0 : 1,
      start_time: start_time || null,
    })
}

// ---- Scheduled Message Groups ----
function getScheduledMessageGroups(guildId) {
  return getDb()
    .prepare('SELECT * FROM scheduled_message_groups WHERE guild_id = ? ORDER BY sort_order ASC, id ASC')
    .all(guildId)
}

function createScheduledMessageGroup({ guild_id, name, sort_order }) {
  return getDb()
    .prepare('INSERT INTO scheduled_message_groups (guild_id, name, sort_order) VALUES (?, ?, ?)')
    .run(guild_id, name, sort_order || 0)
}

function updateScheduledMessageGroup(id, guildId, { name, sort_order }) {
  return getDb()
    .prepare(`
      UPDATE scheduled_message_groups SET
        name = COALESCE(@name, name),
        sort_order = COALESCE(@sort_order, sort_order)
      WHERE id = @id AND guild_id = @guild_id
    `)
    .run({ id, guild_id: guildId, name: name ?? null, sort_order: sort_order ?? null })
}

function deleteScheduledMessageGroup(id, guildId) {
  const db = getDb()
  // Detach messages instead of deleting them
  db.prepare('UPDATE scheduled_messages SET group_id = NULL WHERE group_id = ? AND guild_id = ?').run(id, guildId)
  return db.prepare('DELETE FROM scheduled_message_groups WHERE id = ? AND guild_id = ?').run(id, guildId)
}

function deleteScheduledMessage(id, guildId) {
  return getDb()
    .prepare('DELETE FROM scheduled_messages WHERE id = ? AND guild_id = ?')
    .run(id, guildId)
}

function markScheduledMessageSent(id) {
  return getDb()
    .prepare('UPDATE scheduled_messages SET last_sent_at = unixepoch() WHERE id = ?')
    .run(id)
}

// Tra ve tat ca msg enabled cua interval-mode toi han.
// Cron-mode (schedule_time IS NOT NULL) duoc tra ve toan bo de caller dung schedule-time-helper kiem tra.
function getDueScheduledMessages(nowSec) {
  return getDb()
    .prepare(`
      SELECT * FROM scheduled_messages
      WHERE enabled = 1
        AND (
          schedule_time IS NOT NULL
          OR start_time IS NOT NULL
          OR last_sent_at IS NULL
          OR (? - last_sent_at) >= interval_minutes * 60
        )
    `)
    .all(nowSec)
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

function incrementUserMessageCount(userId, guildId) {
  return getDb()
    .prepare(`
      INSERT INTO users (id, guild_id, message_count, updated_at)
      VALUES (?, ?, 1, unixepoch())
      ON CONFLICT(id, guild_id) DO UPDATE SET message_count = message_count + 1
    `)
    .run(userId, guildId)
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

// Xóa nhiều link cùng lúc theo danh sách id
function deleteLinks(ids, guildId) {
  if (!Array.isArray(ids) || ids.length === 0) return { changes: 0 }
  const placeholders = ids.map(() => '?').join(',')
  return getDb()
    .prepare(`DELETE FROM links WHERE guild_id = ? AND id IN (${placeholders})`)
    .run(guildId, ...ids)
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

// ============================================================
// Welcome Template (chao mung member moi)
// ============================================================
const WELCOME_DEFAULTS = {
  enabled: 1,
  message: 'Chào mừng {user} đã tham gia server! 🎉 Hãy giới thiệu bản thân và làm quen với mọi người nhé.',
}

function getWelcomeTemplate(guildId) {
  const row = getDb()
    .prepare('SELECT * FROM welcome_template WHERE guild_id = ?')
    .get(guildId)
  return row || { guild_id: guildId, ...WELCOME_DEFAULTS }
}

function upsertWelcomeTemplate({ guild_id, enabled, message, image_url }) {
  return getDb()
    .prepare(`
      INSERT INTO welcome_template (guild_id, enabled, message, image_url, updated_at)
      VALUES (@guild_id, @enabled, @message, @image_url, unixepoch())
      ON CONFLICT(guild_id) DO UPDATE SET
        enabled = excluded.enabled,
        message = excluded.message,
        image_url = excluded.image_url,
        updated_at = unixepoch()
    `)
    .run({
      guild_id,
      enabled: enabled ? 1 : 0,
      message: message || WELCOME_DEFAULTS.message,
      image_url: image_url || null,
    })
}

function getChannelsWithLinks(guildId) {
  return getDb()
    .prepare('SELECT DISTINCT channel_id, channel_name FROM links WHERE guild_id = ? ORDER BY channel_name ASC')
    .all(guildId)
}

module.exports = {
  initDb,
  getDb,
  getUser,
  upsertUser,
  getRewards,
  getRewardById,
  upsertReward,
  deleteReward,
  getSettings,
  upsertSettings,
  updatePostSettings,
  getUserRank,
  getLeaderboard,
  getAllUsers,
  incrementUserMessageCount,
  resetUserXp,
  deleteUser,
  saveLink,
  getLinks,
  countLinks,
  deleteLink,
  deleteLinks,
  getChannelsWithLinks,
  getLevelUpTemplate,
  upsertLevelUpTemplate,
  getWelcomeTemplate,
  upsertWelcomeTemplate,
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
  getScheduledMessages,
  getScheduledMessageById,
  createScheduledMessage,
  updateScheduledMessage,
  deleteScheduledMessage,
  markScheduledMessageSent,
  getDueScheduledMessages,
  getScheduledMessageGroups,
  createScheduledMessageGroup,
  updateScheduledMessageGroup,
  deleteScheduledMessageGroup,
}
