const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const db = require('../../shared/db')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID
const UPLOADS_DIR = path.join(__dirname, '../../uploads')

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${crypto.randomUUID()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (allowed.includes(file.mimetype)) return cb(null, true)
    cb(new Error('Chỉ chấp nhận ảnh JPEG, PNG, GIF, WEBP'))
  },
})

router.get('/', (req, res) => {
  res.json(db.getRewards(GUILD_ID()))
})

router.post('/', (req, res) => {
  const { level_required, type, role_id, badge_url, badge_name } = req.body

  if (!level_required || !type) {
    return res.status(400).json({ error: 'level_required và type là bắt buộc' })
  }
  if (type === 'role' && !role_id) {
    return res.status(400).json({ error: 'role_id là bắt buộc khi type=role' })
  }
  if (type === 'badge' && !badge_url) {
    return res.status(400).json({ error: 'badge_url là bắt buộc khi type=badge' })
  }

  const result = db.upsertReward({
    guild_id: GUILD_ID(),
    level_required: Number(level_required),
    type,
    role_id: role_id || null,
    badge_url: badge_url || null,
    badge_name: badge_name || null,
  })
  res.status(201).json({ id: result.lastInsertRowid })
})

router.put('/:id', (req, res) => {
  const existing = db.getRewardById(req.params.id, GUILD_ID())
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy reward' })

  const { level_required, type, role_id, badge_url, badge_name } = req.body
  db.upsertReward({
    id: req.params.id,
    guild_id: GUILD_ID(),
    level_required: level_required !== undefined ? Number(level_required) : existing.level_required,
    type: type ?? existing.type,
    role_id: role_id !== undefined ? role_id : existing.role_id,
    badge_url: badge_url !== undefined ? badge_url : existing.badge_url,
    badge_name: badge_name !== undefined ? badge_name : existing.badge_name,
  })
  res.json({ success: true })
})

router.delete('/:id', (req, res) => {
  const existing = db.getRewardById(req.params.id, GUILD_ID())
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy reward' })

  if (existing.type === 'badge' && existing.badge_url) {
    const filePath = path.join(UPLOADS_DIR, path.basename(existing.badge_url))
    fs.unlink(filePath, () => {})
  }

  db.deleteReward(req.params.id, GUILD_ID())
  res.json({ success: true })
})

router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file được upload' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

module.exports = router
