// CRUD cho tinh nang vinh danh (Hall of Fame)
// Bang: honor_settings (cau hinh role/channel) + honor_history (lich su vinh danh)
const { getDb } = require('./db')

// ============================================================
// honor_settings — cau hinh role duoc phep dung /vinhdanh + channel mac dinh
// ============================================================
function getHonorSettings(guildId) {
  const row = getDb()
    .prepare('SELECT * FROM honor_settings WHERE guild_id = ?')
    .get(guildId)
  if (!row) return { guild_id: guildId, allowed_role_ids: [], default_channel_id: null }
  let allowed = []
  try { allowed = row.allowed_role_ids ? JSON.parse(row.allowed_role_ids) : [] } catch (_) { allowed = [] }
  return { ...row, allowed_role_ids: allowed }
}

function upsertHonorSettings({ guild_id, allowed_role_ids, default_channel_id }) {
  const allowedJson = JSON.stringify(Array.isArray(allowed_role_ids) ? allowed_role_ids : [])
  return getDb()
    .prepare(`
      INSERT INTO honor_settings (guild_id, allowed_role_ids, default_channel_id, updated_at)
      VALUES (@guild_id, @allowed_role_ids, @default_channel_id, unixepoch())
      ON CONFLICT(guild_id) DO UPDATE SET
        allowed_role_ids = excluded.allowed_role_ids,
        default_channel_id = excluded.default_channel_id,
        updated_at = unixepoch()
    `)
    .run({
      guild_id,
      allowed_role_ids: allowedJson,
      default_channel_id: default_channel_id || null,
    })
}

// ============================================================
// honor_history — moi lan vinh danh
// ============================================================
function insertHonorRecord(record) {
  const info = getDb()
    .prepare(`
      INSERT INTO honor_history (
        guild_id, channel_id, message_id, title, banner_url,
        user1_id, user1_reason, user2_id, user2_reason, user3_id, user3_reason,
        created_by
      ) VALUES (
        @guild_id, @channel_id, @message_id, @title, @banner_url,
        @user1_id, @user1_reason, @user2_id, @user2_reason, @user3_id, @user3_reason,
        @created_by
      )
    `)
    .run({
      message_id: null,
      banner_url: null,
      ...record,
    })
  return info.lastInsertRowid
}

function updateHonorMessageId(id, messageId) {
  return getDb()
    .prepare('UPDATE honor_history SET message_id = ? WHERE id = ?')
    .run(messageId, id)
}

function listHonorHistory(guildId, limit = 10) {
  return getDb()
    .prepare(`
      SELECT * FROM honor_history
      WHERE guild_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(guildId, limit)
}

function getHonorRecord(id) {
  return getDb()
    .prepare('SELECT * FROM honor_history WHERE id = ?')
    .get(id)
}

// ============================================================
// honor_team_history — vinh danh team (1-10 thanh vien)
// ============================================================
function insertHonorTeamRecord(record) {
  const memberIdsJson = Array.isArray(record.member_ids)
    ? JSON.stringify(record.member_ids)
    : (record.member_ids || '[]')
  const info = getDb()
    .prepare(`
      INSERT INTO honor_team_history (
        guild_id, channel_id, message_id, title, team_name, reason,
        banner_url, member_ids, created_by
      ) VALUES (
        @guild_id, @channel_id, @message_id, @title, @team_name, @reason,
        @banner_url, @member_ids, @created_by
      )
    `)
    .run({
      message_id: null,
      banner_url: null,
      ...record,
      member_ids: memberIdsJson,
    })
  return info.lastInsertRowid
}

function updateHonorTeamMessageId(id, messageId) {
  return getDb()
    .prepare('UPDATE honor_team_history SET message_id = ? WHERE id = ?')
    .run(messageId, id)
}

function parseMemberIds(row) {
  if (!row) return row
  let ids = []
  try { ids = row.member_ids ? JSON.parse(row.member_ids) : [] } catch (_) { ids = [] }
  return { ...row, member_ids: ids }
}

function listHonorTeamHistory(guildId, limit = 10) {
  const rows = getDb()
    .prepare(`
      SELECT * FROM honor_team_history
      WHERE guild_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(guildId, limit)
  return rows.map(parseMemberIds)
}

function getHonorTeamRecord(id) {
  return parseMemberIds(
    getDb().prepare('SELECT * FROM honor_team_history WHERE id = ?').get(id),
  )
}

// ============================================================
// UNION: liet ke ca top3 va team theo thoi gian
// ============================================================
function listHonorAllHistory(guildId, limit = 10) {
  return getDb()
    .prepare(`
      SELECT 'top3' AS type, id, guild_id, channel_id, message_id, title,
             NULL AS team_name, user1_id, user2_id, user3_id, NULL AS member_ids,
             created_by, created_at
      FROM honor_history WHERE guild_id = ?
      UNION ALL
      SELECT 'team' AS type, id, guild_id, channel_id, message_id, title,
             team_name, NULL AS user1_id, NULL AS user2_id, NULL AS user3_id, member_ids,
             created_by, created_at
      FROM honor_team_history WHERE guild_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(guildId, guildId, limit)
    .map(row => {
      if (row.type === 'team' && row.member_ids) {
        try { row.member_ids = JSON.parse(row.member_ids) } catch (_) { row.member_ids = [] }
      }
      return row
    })
}

module.exports = {
  getHonorSettings,
  upsertHonorSettings,
  insertHonorRecord,
  updateHonorMessageId,
  listHonorHistory,
  getHonorRecord,
  insertHonorTeamRecord,
  updateHonorTeamMessageId,
  listHonorTeamHistory,
  getHonorTeamRecord,
  listHonorAllHistory,
}
