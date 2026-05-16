const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const db = require('../../shared/db')
const { resolveImage } = require('../../shared/build-scheduled-payload')

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
    else cb(new Error('Chỉ chấp nhận JPEG/PNG/GIF/WEBP'))
  },
})

router.get('/', (req, res) => {
  const tpl = db.getWelcomeTemplate(GUILD_ID())
  res.json({ ...tpl, enabled: !!tpl.enabled })
})

router.put('/', (req, res) => {
  const { enabled, message, image_url } = req.body
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Nội dung tin nhắn là bắt buộc' })
  }
  if (message.length > 1800) {
    return res.status(400).json({ error: 'Tin nhắn không được vượt quá 1800 ký tự' })
  }
  db.upsertWelcomeTemplate({
    guild_id: GUILD_ID(),
    enabled: enabled ? 1 : 0,
    message: message.trim(),
    image_url: image_url || null,
  })
  res.json({ success: true })
})

// Upload ảnh đính kèm tin nhắn chào mừng
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

// Gửi test tới channel level_up_reply (hoặc channel_id truyền vào)
router.post('/test', async (req, res) => {
  const { channel_id, message, image_url } = req.body
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chưa được cấu hình' })

  const settings = db.getSettings(GUILD_ID())
  const targetChannel = channel_id || settings?.level_up_reply_channel_id
  if (!targetChannel) {
    return res.status(400).json({ error: 'Chưa cấu hình "Channel auto-reply khi lên cấp" trong tab Cấu hình' })
  }

  const tpl = db.getWelcomeTemplate(GUILD_ID())
  const rawMsg = message != null ? message : tpl.message
  const imgRaw = image_url !== undefined ? image_url : tpl.image_url
  // Test khong co user thuc → dung placeholder
  const content = `**[TEST]** ` + (rawMsg || '')
    .replace(/\{user\}/g, '<@!000000000000000000>')
    .replace(/\{username\}/g, 'TestUser')

  const { url: imgUrl, filePath, filename } = resolveImage(imgRaw)
  const payload = { content, allowed_mentions: { parse: [] } }
  if (imgUrl) payload.embeds = [{ image: { url: imgUrl } }]

  const url = `https://discord.com/api/v10/channels/${targetChannel}/messages`
  try {
    let r
    if (filePath) {
      const form = new FormData()
      form.append('payload_json', JSON.stringify(payload))
      const buf = fs.readFileSync(filePath)
      form.append('files[0]', new Blob([buf]), filename)
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${process.env.BOT_TOKEN}` },
        body: form,
      })
    } else {
      r = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${process.env.BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    }
    if (!r.ok) {
      const errText = await r.text()
      return res.status(r.status).json({ error: `Discord API ${r.status}: ${errText.slice(0, 300)}` })
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
