const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const db = require('../../shared/db')
const { buildPayload } = require('../../shared/build-scheduled-payload')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../..')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (ok.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Chi chap nhan JPEG/PNG/GIF/WEBP'))
  },
})

router.get('/', (req, res) => {
  res.json(db.getScheduledMessages(GUILD_ID()))
})

// ---- Groups CRUD (must be before /:id routes) ----
router.get('/groups', (req, res) => {
  res.json(db.getScheduledMessageGroups(GUILD_ID()))
})

router.post('/groups', (req, res) => {
  const { name, sort_order } = req.body
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name bat buoc' })
  const result = db.createScheduledMessageGroup({
    guild_id: GUILD_ID(),
    name: String(name).trim(),
    sort_order: Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
  })
  res.json({ id: result.lastInsertRowid })
})

router.put('/groups/:id', (req, res) => {
  const id = Number(req.params.id)
  const { name, sort_order } = req.body
  db.updateScheduledMessageGroup(id, GUILD_ID(), {
    name: name !== undefined ? String(name).trim() : undefined,
    sort_order: sort_order !== undefined ? Number(sort_order) : undefined,
  })
  res.json({ success: true })
})

router.delete('/groups/:id', (req, res) => {
  const id = Number(req.params.id)
  db.deleteScheduledMessageGroup(id, GUILD_ID())
  res.json({ success: true })
})

router.post('/', (req, res) => {
  const { channel_id, name, content, image_url, interval_minutes, enabled, use_embed, embed_title, embed_color, group_id } = req.body
  if (!channel_id) return res.status(400).json({ error: 'channel_id bat buoc' })
  if (!content && !image_url && !embed_title) return res.status(400).json({ error: 'Phai co content, anh hoac embed title' })
  const mins = Number(interval_minutes)
  if (!Number.isFinite(mins) || mins < 1) return res.status(400).json({ error: 'interval_minutes phai >= 1' })
  const result = db.createScheduledMessage({
    guild_id: GUILD_ID(), channel_id, name, content, image_url,
    interval_minutes: mins, enabled: !!enabled,
    use_embed: !!use_embed, embed_title, embed_color,
    group_id: group_id ? Number(group_id) : null,
  })
  res.json({ id: result.lastInsertRowid })
})

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.getScheduledMessageById(id, GUILD_ID())
  if (!existing) return res.status(404).json({ error: 'Khong tim thay' })
  const { channel_id, name, content, image_url, interval_minutes, enabled, use_embed, embed_title, embed_color, group_id } = req.body
  db.updateScheduledMessage(id, {
    channel_id, name, content, image_url,
    interval_minutes: interval_minutes !== undefined ? Number(interval_minutes) : undefined,
    enabled, use_embed, embed_title, embed_color,
    group_id: group_id === undefined ? undefined : (group_id ? Number(group_id) : null),
  })
  res.json({ success: true })
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  db.deleteScheduledMessage(id, GUILD_ID())
  res.json({ success: true })
})

router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Khong co file' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

// Send ngay (test)
router.post('/:id/send-now', async (req, res) => {
  const id = Number(req.params.id)
  const msg = db.getScheduledMessageById(id, GUILD_ID())
  if (!msg) return res.status(404).json({ error: 'Khong tim thay' })
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chua co' })
  try {
    const { payload, files } = buildPayload(msg, { restAPI: true })
    const url = `https://discord.com/api/v10/channels/${msg.channel_id}/messages`
    let r
    if (files.length > 0) {
      const form = new FormData()
      form.append('payload_json', JSON.stringify(payload))
      files.forEach((f, i) => {
        const buf = fs.readFileSync(f.path)
        form.append(`files[${i}]`, new Blob([buf]), f.name)
      })
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${process.env.BOT_TOKEN}` },
        body: form,
      })
    } else {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${process.env.BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    if (!r.ok) {
      const errText = await r.text()
      return res.status(r.status).json({ error: `Discord ${r.status}: ${errText.slice(0, 200)}` })
    }
    db.markScheduledMessageSent(id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
