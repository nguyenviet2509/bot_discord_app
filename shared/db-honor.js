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

module.exports = {
  getHonorSettings,
  upsertHonorSettings,
  insertHonorRecord,
  updateHonorMessageId,
  listHonorHistory,
  getHonorRecord,
}
