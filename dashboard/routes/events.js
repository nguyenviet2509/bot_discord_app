// REST API cho tab "Quan ly Events".
// Pattern: guild_id lay tu env (giong cac routes hien co).
// Endpoints:
//   GET    /groups
//   POST   /groups
//   PUT    /groups/:id      (rename)
//   DELETE /groups/:id      (detach events -> group_id NULL)
//   PUT    /groups/reorder  (orderedIds)
//   GET    /                (?group_id=null|<num>&page&limit)
//   GET    /types           (?group_id=null|<num>)
//   POST   /
//   PUT    /:id             (partial update)
//   DELETE /:id
//   PUT    /reorder         (updates: [{id, group_id, sort_order}])

const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const eventsDb = require('../../shared/db-events')
const { sendEventAnnouncement } = require('../../shared/send-event-announcement')
const { pickRandomTemplate } = require('../../shared/pick-random-template')

const router = express.Router()

// Upload anh thong bao (giong pattern scheduled-messages)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../..')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => cb(null, `event-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (ok.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Chi chap nhan JPEG/PNG/GIF/WEBP'))
  },
})

router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Khong co file' })
  res.json({ url: `/uploads/${req.file.filename}` })
})
const GUILD_ID = () => process.env.GUILD_ID

// Cac field announce cho phep tu req.body khi POST/PUT event
function pickAnnounceFields(body) {
  const out = {}
  const keys = [
    'announce_channel_id', 'announce_content', 'announce_use_embed',
    'announce_embed_title', 'announce_embed_color', 'announce_image_url',
    'announce_on_enable', 'announce_on_start', 'announce_role_ping_id',
    'recurrence_type', 'recurrence_day_of_week', 'recurrence_time',
    'recurrence_pool_role_id', 'recurrence_template', 'recurrence_excluded_user_ids',
    'recurrence_use_embed', 'recurrence_embed_title', 'recurrence_embed_color', 'recurrence_image_url',
    'announce_recur_type', 'announce_recur_day_of_week', 'announce_recur_time',
  ]
  for (const k of keys) if (body[k] !== undefined) out[k] = body[k]
  return out
}

// Validate channel_id la snowflake (chuoi so 17-20 ky tu) hoac null
function validateChannelId(v) {
  if (v === null || v === undefined || v === '') return true
  return /^\d{15,22}$/.test(String(v))
}

// Parse group_id query: 'null' string -> null, '' -> null, else Number
function parseGroupId(raw) {
  if (raw === undefined || raw === null || raw === '' || raw === 'null') return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return undefined // invalid
  return n
}

function validateType(t) {
  if (typeof t !== 'string') return false
  return eventsDb.TYPE_REGEX.test(t.trim())
}

// ---- Groups (must be before /:id) ----

router.get('/groups', (req, res) => {
  res.json(eventsDb.getGroups(GUILD_ID()))
})

router.post('/groups', (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'name bat buoc' })
  if (name.length > 50) return res.status(400).json({ error: 'name toi da 50 ky tu' })
  const result = eventsDb.createGroup(GUILD_ID(), name)
  res.json({ id: result.lastInsertRowid })
})

router.put('/groups/reorder', (req, res) => {
  const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map(Number).filter(Number.isInteger) : null
  if (!orderedIds) return res.status(400).json({ error: 'orderedIds phai la mang so' })
  eventsDb.reorderGroups(GUILD_ID(), orderedIds)
  res.json({ success: true })
})

router.put('/groups/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id khong hop le' })
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'name bat buoc' })
  if (name.length > 50) return res.status(400).json({ error: 'name toi da 50 ky tu' })
  eventsDb.updateGroup(id, GUILD_ID(), name)
  res.json({ success: true })
})

router.delete('/groups/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id khong hop le' })
  eventsDb.deleteGroup(id, GUILD_ID())
  res.json({ success: true })
})

// ---- Types suggestions ----
router.get('/types', (req, res) => {
  const gid = parseGroupId(req.query.group_id)
  if (gid === undefined) return res.status(400).json({ error: 'group_id khong hop le' })
  res.json(eventsDb.listTypesForGroup(GUILD_ID(), gid))
})

// ---- Reorder events (cross-group + reorder cung group) ----
router.put('/reorder', (req, res) => {
  const updates = Array.isArray(req.body?.updates) ? req.body.updates : null
  if (!updates) return res.status(400).json({ error: 'updates phai la mang' })
  // Validate moi item: id int, sort_order so, group_id null hoac int
  for (const u of updates) {
    if (!Number.isInteger(Number(u.id))) return res.status(400).json({ error: 'updates[].id sai' })
    if (!Number.isFinite(Number(u.sort_order))) return res.status(400).json({ error: 'updates[].sort_order sai' })
    if (u.group_id !== null && u.group_id !== undefined && u.group_id !== '' && !Number.isInteger(Number(u.group_id))) {
      return res.status(400).json({ error: 'updates[].group_id sai' })
    }
  }
  eventsDb.reorderEvents(GUILD_ID(), updates)
  res.json({ success: true })
})

// ---- Events ----

router.get('/', (req, res) => {
  const gid = parseGroupId(req.query.group_id)
  if (gid === undefined) return res.status(400).json({ error: 'group_id khong hop le' })
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10))
  res.json(eventsDb.listEvents(GUILD_ID(), gid, page, limit))
})

router.post('/', (req, res) => {
  const { name, description, type, status, start_at, end_at, group_id } = req.body || {}
  const trimName = String(name || '').trim()
  if (!trimName) return res.status(400).json({ error: 'name bat buoc' })
  if (trimName.length > 100) return res.status(400).json({ error: 'name toi da 100 ky tu' })
  if (!validateType(String(type || '').trim())) {
    return res.status(400).json({ error: 'type khong hop le (chi a-z, 0-9, _ , -, toi da 30 ky tu)' })
  }
  if (start_at && end_at && Number(end_at) <= Number(start_at)) {
    return res.status(400).json({ error: 'end_at phai sau start_at' })
  }
  const gid = (group_id === null || group_id === undefined || group_id === '') ? null : Number(group_id)
  if (gid !== null && (!Number.isInteger(gid) || gid <= 0)) {
    return res.status(400).json({ error: 'group_id khong hop le' })
  }
  const announce = pickAnnounceFields(req.body || {})
  if (announce.announce_channel_id !== undefined && !validateChannelId(announce.announce_channel_id)) {
    return res.status(400).json({ error: 'announce_channel_id phai la Discord channel ID (chuoi so)' })
  }
  const result = eventsDb.createEvent({
    guild_id: GUILD_ID(),
    group_id: gid,
    name: trimName,
    description: description ? String(description).slice(0, 1000) : null,
    type: String(type).trim().toLowerCase(),
    status: !!status,
    start_at: start_at ? Number(start_at) : null,
    end_at: end_at ? Number(end_at) : null,
    ...announce,
  })
  res.json({ id: result.lastInsertRowid })
})

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id khong hop le' })
  const existing = eventsDb.getEventById(id, GUILD_ID())
  if (!existing) return res.status(404).json({ error: 'Khong tim thay' })
  const { name, description, type, status, start_at, end_at, group_id } = req.body || {}
  const fields = {}
  if (name !== undefined) {
    const trimName = String(name).trim()
    if (!trimName) return res.status(400).json({ error: 'name bat buoc' })
    if (trimName.length > 100) return res.status(400).json({ error: 'name toi da 100 ky tu' })
    fields.name = trimName
  }
  if (description !== undefined) fields.description = description ? String(description).slice(0, 1000) : null
  if (type !== undefined) {
    const t = String(type).trim().toLowerCase()
    if (!validateType(t)) return res.status(400).json({ error: 'type khong hop le' })
    fields.type = t
  }
  if (status !== undefined) fields.status = !!status
  if (start_at !== undefined) fields.start_at = start_at ? Number(start_at) : null
  if (end_at !== undefined) fields.end_at = end_at ? Number(end_at) : null
  // Validate start/end khi ca 2 deu hien dien (sau merge)
  const finalStart = fields.start_at !== undefined ? fields.start_at : existing.start_at
  const finalEnd = fields.end_at !== undefined ? fields.end_at : existing.end_at
  if (finalStart && finalEnd && Number(finalEnd) <= Number(finalStart)) {
    return res.status(400).json({ error: 'end_at phai sau start_at' })
  }
  if (group_id !== undefined) {
    if (group_id === null || group_id === '') fields.group_id = null
    else {
      const gid = Number(group_id)
      if (!Number.isInteger(gid) || gid <= 0) return res.status(400).json({ error: 'group_id khong hop le' })
      fields.group_id = gid
    }
  }
  const announce = pickAnnounceFields(req.body || {})
  if (announce.announce_channel_id !== undefined && !validateChannelId(announce.announce_channel_id)) {
    return res.status(400).json({ error: 'announce_channel_id phai la Discord channel ID (chuoi so)' })
  }
  Object.assign(fields, announce)

  // Detect status flip 0 -> 1 de auto-send neu announce_on_enable=1
  const statusFlipOn = existing.status === 0 && fields.status === true
  const willResetSent = fields.status === false  // tat di -> cho phep gui lai lan sau
  if (willResetSent) fields.announce_sent_at = null

  eventsDb.updateEvent(id, GUILD_ID(), fields)

  // Auto send tren toggle ON
  if (statusFlipOn) {
    const updated = eventsDb.getEventById(id, GUILD_ID())
    if (updated.announce_on_enable && !updated.announce_sent_at && updated.announce_channel_id) {
      const result = await sendEventAnnouncement(updated)
      if (result.ok) eventsDb.markAnnouncementSent(id, GUILD_ID())
      // Khong block response neu send fail — log silent
      else console.warn(`[events] auto-send-on-enable id=${id} fail: ${result.error}`)
    }
  }
  res.json({ success: true })
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id khong hop le' })
  eventsDb.deleteEvent(id, GUILD_ID())
  res.json({ success: true })
})

// Gui thu thong bao KET QUA (random pick member tu pool role + replace {member})
// Khong cap nhat recurrence_last_run_at (de khong block lich auto sau nay).
router.post('/:id/test-result', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id khong hop le' })
  const event = eventsDb.getEventById(id, GUILD_ID())
  if (!event) return res.status(404).json({ error: 'Khong tim thay event' })
  if (!event.recurrence_pool_role_id) return res.status(400).json({ error: 'Chua chon role pool' })
  if (!event.recurrence_template) return res.status(400).json({ error: 'Chua nhap mau tin nhan {member}' })
  if (!event.announce_channel_id) return res.status(400).json({ error: 'Chua chon channel gui' })

  // Lay danh sach member trong role qua Discord REST API (dashboard process, khong co client cache)
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chua duoc cau hinh' })
  try {
    const guildId = GUILD_ID()
    const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
      headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` },
    })
    if (!r.ok) {
      const t = await r.text()
      return res.status(502).json({ error: `Discord ${r.status}: ${t.slice(0, 200)}` })
    }
    const members = await r.json()
    const candidates = members.filter(m => !m.user?.bot && Array.isArray(m.roles) && m.roles.includes(event.recurrence_pool_role_id))
    if (candidates.length === 0) return res.status(400).json({ error: 'Khong co thanh vien nao trong role nay' })
    // Strict: loai winner gan nhat + danh sach excluded
    const excludeSet = new Set(eventsDb.parseExcludedIds(event.recurrence_excluded_user_ids))
    if (event.recurrence_last_winner_id) excludeSet.add(event.recurrence_last_winner_id)
    const pool = candidates.filter(m => !excludeSet.has(m.user.id))
    if (pool.length === 0) return res.status(400).json({ error: 'Khong con thanh vien hop le sau khi loai winner cu va danh sach exclude' })
    const picked = pool[Math.floor(Math.random() * pool.length)]
    const tpl = pickRandomTemplate(event.recurrence_template)
    const content = tpl.replace(/\{member\}/g, `<@${picked.user.id}>`)
    const shaped = {
      ...event,
      announce_content: content,
      announce_use_embed: event.recurrence_use_embed,
      announce_embed_title: event.recurrence_embed_title,
      announce_embed_color: event.recurrence_embed_color,
      announce_image_url: event.recurrence_image_url,
    }
    const result = await sendEventAnnouncement(shaped)
    if (!result.ok) return res.status(result.status || 500).json({ error: result.error })
    const name = picked.nick || picked.user.global_name || picked.user.username || picked.user.id
    res.json({ success: true, picked: { id: picked.user.id, name } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Gui tin nhan thong bao ngay (test / manual)
// Force: gui kech ca khi da gui truoc do. Khong update announce_sent_at neu force.
router.post('/:id/send-now', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id khong hop le' })
  const event = eventsDb.getEventById(id, GUILD_ID())
  if (!event) return res.status(404).json({ error: 'Khong tim thay event' })
  const force = !!req.body?.force
  const result = await sendEventAnnouncement(event)
  if (!result.ok) return res.status(result.status || 500).json({ error: result.error })
  // Chi mark sent neu khong phai force (force = test, khong block auto sau nay)
  if (!force) eventsDb.markAnnouncementSent(id, GUILD_ID())
  res.json({ success: true })
})

module.exports = router
