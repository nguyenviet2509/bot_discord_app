// API CRUD + lifecycle cho cac bot phu (multi lite bots).
// Mounted tai /api/managed-bots voi auth middleware o server.js.

const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const dbManaged = require('../../shared/db-managed-bots')
const { encrypt, decrypt } = require('../../bots-lite/token-crypto')
const manager = require('../../bots-lite')

const router = express.Router()

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../..')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads', 'managed-bots')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const MAX_AVATAR_SIZE = 1 * 1024 * 1024 // 1MB

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png'
      cb(null, `${crypto.randomUUID()}${ext}`)
    },
  }),
  limits: { fileSize: MAX_AVATAR_SIZE },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (ok.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Chi chap nhan JPEG/PNG/GIF/WEBP'))
  },
})

// Validate token bang cach goi GET /users/@me cua Discord
async function validateDiscordToken(token) {
  const r = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bot ${token}` },
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Discord tu choi token (${r.status}): ${text.slice(0, 200)}`)
  }
  return r.json() // { id, username, avatar, ... }
}

function withCanChangeUsername(bot) {
  return { ...bot, can_change_username: manager.canChangeUsername(bot) }
}

router.get('/', (req, res) => {
  const bots = dbManaged.listBots().map(withCanChangeUsername)
  res.json(bots)
})

router.post('/', async (req, res) => {
  const { display_name, token, presence_status, activity_type, activity_text } = req.body
  if (!display_name || !display_name.trim()) {
    return res.status(400).json({ error: 'Ten hien thi bat buoc' })
  }
  if (!token || !token.trim()) {
    return res.status(400).json({ error: 'Token bat buoc' })
  }
  let me
  try {
    me = await validateDiscordToken(token.trim())
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
  let enc
  try {
    enc = encrypt(token.trim())
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
  const id = dbManaged.createBot({
    display_name: display_name.trim(),
    discord_token: enc.ciphertext,
    token_iv: enc.iv,
    application_id: me.id,
    presence_status,
    activity_type,
    activity_text,
  })
  res.status(201).json(withCanChangeUsername(dbManaged.getBot(id)))
})

router.patch('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const bot = dbManaged.getBot(id)
  if (!bot) return res.status(404).json({ error: 'Bot khong ton tai' })

  const patch = {}
  const { display_name, avatar_url, presence_status, activity_type, activity_text } = req.body
  if (display_name !== undefined) {
    if (!display_name.trim()) return res.status(400).json({ error: 'Ten hien thi khong duoc rong' })
    patch.display_name = display_name.trim()
  }
  if (avatar_url !== undefined) patch.avatar_url = avatar_url || null
  if (presence_status !== undefined) patch.presence_status = presence_status
  if (activity_type !== undefined) patch.activity_type = activity_type
  if (activity_text !== undefined) {
    patch.activity_text = activity_text ? String(activity_text).slice(0, 128) : null
  }

  // Apply runtime truoc DB de bat error rate limit
  if (manager.isRunning(id)) {
    try {
      const result = await manager.applyRuntimeChanges(id, patch)
      if (result.usernameChanged) {
        dbManaged.recordUsernameChange(id)
      }
    } catch (err) {
      const msg = err?.message || ''
      const isDiscordRateLimit =
        err?.status === 429 ||
        err?.name === 'RateLimitError' ||
        /rate.?limit|too many requests/i.test(msg)
      if (isDiscordRateLimit) {
        return res.status(429).json({
          error:
            'Discord giới hạn đổi avatar/tên cho bot (khoảng 2 lần / 10 phút). Vui lòng đợi vài phút rồi thử lại, hoặc tắt rồi bật lại bot để áp dụng ngay.',
        })
      }
      return res.status(429).json({ error: err.message })
    }
  }
  dbManaged.updateBot(id, patch)
  res.json(withCanChangeUsername(dbManaged.getBot(id)))
})

router.post('/:id/avatar', upload.single('file'), (req, res) => {
  const id = parseInt(req.params.id, 10)
  const bot = dbManaged.getBot(id)
  if (!bot) {
    if (req.file) { try { fs.unlinkSync(req.file.path) } catch (_) {} }
    return res.status(404).json({ error: 'Bot khong ton tai' })
  }
  if (!req.file) return res.status(400).json({ error: 'Khong co file' })
  const avatarUrl = `/uploads/managed-bots/${req.file.filename}`
  // Xoa avatar cu (neu la file local)
  if (bot.avatar_url && bot.avatar_url.startsWith('/uploads/managed-bots/')) {
    const old = path.join(DATA_DIR, bot.avatar_url)
    if (fs.existsSync(old)) { try { fs.unlinkSync(old) } catch (_) {} }
  }
  dbManaged.updateBot(id, { avatar_url: avatarUrl })
  // Khong apply runtime o day — frontend goi PATCH sau de trigger nhu binh thuong
  res.json({ avatar_url: avatarUrl })
})

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const bot = dbManaged.getBot(id)
  if (!bot) return res.status(404).json({ error: 'Bot khong ton tai' })
  if (manager.isRunning(id)) {
    await manager.stop(id).catch(() => {})
  }
  if (bot.avatar_url && bot.avatar_url.startsWith('/uploads/managed-bots/')) {
    const file = path.join(DATA_DIR, bot.avatar_url)
    if (fs.existsSync(file)) { try { fs.unlinkSync(file) } catch (_) {} }
  }
  dbManaged.deleteBot(id)
  res.json({ success: true })
})

router.post('/:id/start', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const bot = dbManaged.getBot(id)
  if (!bot) return res.status(404).json({ error: 'Bot khong ton tai' })
  // Ghi intent truoc → dashboard restart se tu start lai bot nay
  dbManaged.setDesiredState(id, 'running')
  try {
    const result = await manager.start(id)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/:id/stop', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const bot = dbManaged.getBot(id)
  if (!bot) return res.status(404).json({ error: 'Bot khong ton tai' })
  // User chu y stop → khong auto-restore khi dashboard boot lai
  dbManaged.setDesiredState(id, 'stopped')
  try {
    const result = await manager.stop(id)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Multer error handler
router.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'Ảnh vượt giới hạn 1MB. Vui lòng nén hoặc resize ảnh trước khi tải lên.',
    })
  }
  if (err) return res.status(400).json({ error: err.message })
  next()
})

module.exports = router
