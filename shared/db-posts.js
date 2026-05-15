// CRUD cho bang posts (post approval flow)
// Tach rieng khoi shared/db.js de tranh file qua lon
const Database = require('better-sqlite3')
const path = require('path')

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..')
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

// Tao bai dang moi (status mac dinh = pending)
function createPost({ guild_id, author_id, author_tag, author_avatar, title, content, price, contact, image_url }) {
  const nowSec = Math.floor(Date.now() / 1000)
  const info = getDb()
    .prepare(`
      INSERT INTO posts (
        guild_id, author_id, author_tag, author_avatar,
        title, content, price, contact, image_url, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `)
    .run(
      guild_id, author_id, author_tag || null, author_avatar || null,
      title, content, price || null, contact || null, image_url || null,
      nowSec, nowSec
    )
  return info.lastInsertRowid
}

function getPost(id) {
  return getDb().prepare('SELECT * FROM posts WHERE id = ?').get(id)
}

// Lay bai cua 1 author theo cac status cho phep
function getPostsByAuthor(guildId, authorId, statuses = ['pending', 'approved']) {
  if (!statuses.length) return []
  const placeholders = statuses.map(() => '?').join(',')
  return getDb()
    .prepare(`
      SELECT * FROM posts
      WHERE guild_id = ? AND author_id = ? AND status IN (${placeholders})
      ORDER BY id DESC LIMIT 25
    `)
    .all(guildId, authorId, ...statuses)
}

// Update status + audit fields (approve/reject)
function updatePostStatus(id, fields) {
  const sets = ['status = @status', 'updated_at = unixepoch()']
  const params = { id, status: fields.status }
  if (fields.approver_id !== undefined)     { sets.push('approver_id = @approver_id'); params.approver_id = fields.approver_id }
  if (fields.approver_tag !== undefined)    { sets.push('approver_tag = @approver_tag'); params.approver_tag = fields.approver_tag }
  if (fields.reject_reason !== undefined)   { sets.push('reject_reason = @reject_reason'); params.reject_reason = fields.reject_reason }
  if (fields.public_thread_id !== undefined){ sets.push('public_thread_id = @public_thread_id'); params.public_thread_id = fields.public_thread_id }
  if (fields.review_message_id !== undefined){ sets.push('review_message_id = @review_message_id'); params.review_message_id = fields.review_message_id }
  if (fields.reviewed_at !== undefined)     { sets.push('reviewed_at = @reviewed_at'); params.reviewed_at = fields.reviewed_at }
  getDb().prepare(`UPDATE posts SET ${sets.join(', ')} WHERE id = @id`).run(params)
}

// Update noi dung bai (dung khi edit)
function updatePostContent(id, { title, content, price, contact, image_url, clear_image }) {
  // image_url logic: undefined = giu nguyen, value = set moi, clear_image=true = clear ve null
  const imageSet = clear_image ? 'image_url = NULL' : (image_url !== undefined ? 'image_url = @image_url' : 'image_url = image_url')
  getDb()
    .prepare(`
      UPDATE posts SET
        title = COALESCE(@title, title),
        content = COALESCE(@content, content),
        price = @price,
        contact = @contact,
        ${imageSet},
        updated_at = unixepoch()
      WHERE id = @id
    `)
    .run({ id, title: title ?? null, content: content ?? null, price: price ?? null, contact: contact ?? null, image_url: image_url ?? null })
}

// Set review_message_id (sau khi bot post embed vao #review)
function setPostReviewMessage(id, messageId) {
  getDb().prepare('UPDATE posts SET review_message_id = ?, updated_at = unixepoch() WHERE id = ?').run(messageId, id)
}

// Reset bai ve trang thai pending (dung khi re-review sau edit)
function setPostStatusPending(id) {
  getDb()
    .prepare(`
      UPDATE posts SET
        status = 'pending',
        approver_id = NULL, approver_tag = NULL, reject_reason = NULL, reviewed_at = NULL,
        public_thread_id = NULL,
        updated_at = unixepoch()
      WHERE id = ?
    `)
    .run(id)
}

module.exports = {
  createPost,
  getPost,
  getPostsByAuthor,
  updatePostStatus,
  updatePostContent,
  setPostReviewMessage,
  setPostStatusPending,
}
