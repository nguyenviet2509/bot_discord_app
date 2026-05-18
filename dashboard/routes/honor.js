// Dashboard routes cho tinh nang vinh danh
const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const dbHonor = require('../../shared/db-honor')
const { buildHonorEmbed } = require('../../shared/build-honor-embed')
const { buildHonorTeamEmbed } = require('../../shared/build-honor-team-embed')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID
const CLIENT_ID = () => process.env.CLIENT_ID
const BOT_TOKEN = () => process.env.BOT_TOKEN

// Banner upload (luu disk uploads/)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../..')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const bannerUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png'
      cb(null, `honor-banner-${crypto.randomUUID()}${ext}`)
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true)
    else cb(new Error('Chi cho phep image/*'))
  },
})

// Multer memoryStorage cho emoji upload — file nho (256KB), khong can ghi disk
const emojiUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 256 * 1024 },
  fileFilter: (_, file, cb) => {
    if (/^image\/(png|jpeg|gif|webp)$/.test(file.mimetype)) cb(null, true)
    else cb(new Error('Chi cho phep PNG, JPG, GIF, WEBP'))
  },
})

// GET /api/honor/settings — lay role/channel config hien tai
router.get('/settings', (req, res) => {
  const settings = dbHonor.getHonorSettings(GUILD_ID())
  res.json(settings)
})

// PUT /api/honor/settings — luu cau hinh (channel mac dinh + emoji huy chuong)
router.put('/settings', (req, res) => {
  const { default_channel_id, gold_emoji, silver_emoji, bronze_emoji } = req.body
  const current = dbHonor.getHonorSettings(GUILD_ID())
  dbHonor.upsertHonorSettings({
    guild_id: GUILD_ID(),
    allowed_role_ids: current.allowed_role_ids || [],
    default_channel_id: default_channel_id !== undefined ? default_channel_id : current.default_channel_id,
    gold_emoji: gold_emoji !== undefined ? gold_emoji : current.gold_emoji,
    silver_emoji: silver_emoji !== undefined ? silver_emoji : current.silver_emoji,
    bronze_emoji: bronze_emoji !== undefined ? bronze_emoji : current.bronze_emoji,
  })
  res.json({ success: true })
})

// POST /api/honor/banner-upload — upload anh banner, tra ve URL
router.post('/banner-upload', bannerUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Khong co file' })
  // Tra ve URL tuyet doi neu co BASE_URL (de Discord fetch duoc), fallback relative
  const base = process.env.BASE_URL || ''
  const relUrl = `/uploads/${req.file.filename}`
  res.json({ url: base ? `${base}${relUrl}` : relUrl, filename: req.file.filename })
})

// GET /api/honor/user-avatar?id=<userId> — fetch avatar URL tu Discord
router.get('/user-avatar', async (req, res) => {
  const userId = String(req.query.id || '').trim()
  if (!/^\d{17,20}$/.test(userId)) return res.status(400).json({ error: 'User ID khong hop le' })
  if (!BOT_TOKEN()) return res.status(500).json({ error: 'BOT_TOKEN chua co' })
  try {
    const r = await fetch(`https://discord.com/api/v10/users/${userId}`, {
      headers: { Authorization: `Bot ${BOT_TOKEN()}` },
    })
    if (!r.ok) return res.status(r.status).json({ error: `Discord ${r.status}` })
    const u = await r.json()
    const ext = u.avatar?.startsWith('a_') ? 'gif' : 'png'
    const avatarUrl = u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${ext}?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${(Number(u.id) >> 22) % 6}.png` // default avatar
    res.json({
      id: u.id,
      username: u.username,
      global_name: u.global_name,
      avatar_url: avatarUrl,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/honor/history?limit=10
router.get('/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50)
  const records = dbHonor.listHonorHistory(GUILD_ID(), limit)
  res.json(records)
})

// GET /api/honor/team-history?limit=10
router.get('/team-history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50)
  const records = dbHonor.listHonorTeamHistory(GUILD_ID(), limit)
  res.json(records)
})

// Helper: inject custom medal emojis tu settings vao payload (chi cho type=top3)
function withMedalEmojis(payload) {
  const s = dbHonor.getHonorSettings(GUILD_ID())
  const medalEmojis = {
    gold: payload.medalEmojis?.gold || s.gold_emoji || undefined,
    silver: payload.medalEmojis?.silver || s.silver_emoji || undefined,
    bronze: payload.medalEmojis?.bronze || s.bronze_emoji || undefined,
  }
  return { ...payload, medalEmojis }
}

// POST /api/honor/preview — render thu embed cho dashboard preview
// Body: { type: 'top3'|'team', ...payload }
router.post('/preview', (req, res) => {
  try {
    const { type, ...payload } = req.body
    const result = type === 'team'
      ? buildHonorTeamEmbed(payload)
      : buildHonorEmbed(withMedalEmojis(payload))
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/honor/send-test — gui that den 1 channel cu the (KHONG luu DB)
// Body: { type, channel_id, ...payload }
router.post('/send-test', async (req, res) => {
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chua co' })
  const { type, channel_id, ...payload } = req.body
  if (!channel_id) return res.status(400).json({ error: 'Thieu channel_id' })
  try {
    const built = type === 'team'
      ? buildHonorTeamEmbed(payload)
      : buildHonorEmbed(withMedalEmojis(payload))
    const url = `https://discord.com/api/v10/channels/${channel_id}/messages`
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bot ${process.env.BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: built.content, embeds: built.embeds }),
    })
    if (!r.ok) {
      const errText = await r.text()
      return res.status(r.status).json({ error: `Discord ${r.status}: ${errText.slice(0, 300)}` })
    }
    const sent = await r.json()
    res.json({ success: true, message_id: sent.id, channel_id })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/honor/channels — fetch danh sach text channel tu Discord
router.get('/channels', async (req, res) => {
  const guildId = GUILD_ID()
  const token = process.env.BOT_TOKEN
  if (!guildId || !token) return res.status(500).json({ error: 'GUILD_ID/BOT_TOKEN chua cau hinh' })
  try {
    const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${token}` },
    })
    if (!r.ok) return res.status(502).json({ error: 'Khong fetch duoc channels' })
    const channels = await r.json()
    // Type 0 = text, 5 = announcement
    const text = channels
      .filter(c => c.type === 0 || c.type === 5)
      .map(c => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
    res.json(text)
  } catch (err) {
    console.error('[honor/channels]', err)
    res.status(500).json({ error: 'Loi server' })
  }
})

// ============================================================
// POST /api/honor/emoji-upload — upload anh thanh Discord Application Emoji
// Body: multipart/form-data { slot: 'gold'|'silver'|'bronze', file: <image> }
// Bot tu post anh len Discord API, khong can tao emoji thu cong tren server.
// ============================================================
const SLOT_TO_NAME = { gold: 'honor_gold', silver: 'honor_silver', bronze: 'honor_bronze' }
const SLOT_TO_COL = { gold: 'gold_emoji', silver: 'silver_emoji', bronze: 'bronze_emoji' }

async function discordApi(path, options = {}) {
  const url = `https://discord.com/api/v10${path}`
  const r = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bot ${BOT_TOKEN()}`,
      ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })
  return r
}

router.post('/emoji-upload', emojiUpload.single('file'), async (req, res) => {
  if (!CLIENT_ID() || !BOT_TOKEN()) {
    return res.status(500).json({ error: 'CLIENT_ID hoac BOT_TOKEN chua cau hinh' })
  }
  if (!req.file) return res.status(400).json({ error: 'Khong co file' })
  const slot = req.body.slot
  if (!SLOT_TO_NAME[slot]) return res.status(400).json({ error: 'slot phai la gold|silver|bronze' })

  const emojiName = SLOT_TO_NAME[slot]
  const mime = req.file.mimetype
  const base64 = req.file.buffer.toString('base64')
  const dataUri = `data:${mime};base64,${base64}`

  try {
    // Step 1: List app emojis hien tai, xoa emoji cu trung ten neu co
    const listR = await discordApi(`/applications/${CLIENT_ID()}/emojis`)
    if (listR.ok) {
      const data = await listR.json()
      const items = data.items || data // tuy version API tra ve {items: []} hoac []
      const existing = items.find(e => e.name === emojiName)
      if (existing) {
        await discordApi(`/applications/${CLIENT_ID()}/emojis/${existing.id}`, { method: 'DELETE' })
      }
    }

    // Step 2: Tao emoji moi
    const createR = await discordApi(`/applications/${CLIENT_ID()}/emojis`, {
      method: 'POST',
      body: JSON.stringify({ name: emojiName, image: dataUri }),
    })
    if (!createR.ok) {
      const err = await createR.text()
      return res.status(createR.status).json({ error: `Discord ${createR.status}: ${err.slice(0, 300)}` })
    }
    const emoji = await createR.json()
    const emojiCode = emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`

    // Step 3: Luu vao honor_settings (chi update cot tuong ung)
    const current = dbHonor.getHonorSettings(GUILD_ID())
    const updated = { ...current }
    updated[SLOT_TO_COL[slot]] = emojiCode
    dbHonor.upsertHonorSettings({
      guild_id: GUILD_ID(),
      allowed_role_ids: updated.allowed_role_ids || [],
      default_channel_id: updated.default_channel_id || null,
      gold_emoji: updated.gold_emoji || null,
      silver_emoji: updated.silver_emoji || null,
      bronze_emoji: updated.bronze_emoji || null,
    })

    res.json({ success: true, emoji_code: emojiCode, emoji_id: emoji.id })
  } catch (err) {
    console.error('[honor/emoji-upload]', err)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/honor/emoji/:slot — xoa emoji 1 slot
router.delete('/emoji/:slot', async (req, res) => {
  const slot = req.params.slot
  if (!SLOT_TO_NAME[slot]) return res.status(400).json({ error: 'slot khong hop le' })
  try {
    // Xoa khoi Discord (best-effort)
    const listR = await discordApi(`/applications/${CLIENT_ID()}/emojis`)
    if (listR.ok) {
      const data = await listR.json()
      const items = data.items || data
      const existing = items.find(e => e.name === SLOT_TO_NAME[slot])
      if (existing) await discordApi(`/applications/${CLIENT_ID()}/emojis/${existing.id}`, { method: 'DELETE' })
    }
    // Xoa khoi DB
    const current = dbHonor.getHonorSettings(GUILD_ID())
    current[SLOT_TO_COL[slot]] = null
    dbHonor.upsertHonorSettings({
      guild_id: GUILD_ID(),
      allowed_role_ids: current.allowed_role_ids || [],
      default_channel_id: current.default_channel_id || null,
      gold_emoji: current.gold_emoji,
      silver_emoji: current.silver_emoji,
      bronze_emoji: current.bronze_emoji,
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
