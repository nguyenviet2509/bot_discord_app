// Dashboard route: quan ly tier flair (emoji + role icon) + test preview
const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const db = require('../../shared/db')
const { LEVEL_TIERS } = require('../../bot/src/services/level-service')
const {
  isValidBadge, buildFlairNickname, getBadgeForTier, getTierConfig,
} = require('../../bot/src/services/tier-flair-service')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../..')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

// Multer cho upload icon role (Discord limit 256KB, recommend 64x64)
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_, file, cb) => cb(null, `tier-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
})
const upload = multer({
  storage,
  limits: { fileSize: 256 * 1024 }, // 256KB Discord limit
  fileFilter: (_, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif']
    if (allowed.includes(file.mimetype)) return cb(null, true)
    cb(new Error('Chỉ chấp nhận JPEG, PNG, GIF (≤256KB)'))
  },
})

// GET: tra ve danh sach 10 tier kem config hien tai
router.get('/', (req, res) => {
  const overrides = db.getTierBadgeOverrides(GUILD_ID())
  const tiers = LEVEL_TIERS.map(t => {
    const ov = overrides.get(t.minLevel)
    return {
      min_level: t.minLevel,
      name: t.name,
      default_badge: t.badge,
      mode: ov?.mode || 'emoji',
      custom_badge: ov?.badge && ov?.mode === 'emoji' ? ov.badge : null,
      role_id: ov?.role_id || null,
      icon_url: ov?.icon_url || null,
      active_badge: ov?.mode === 'emoji' ? (ov?.badge || t.badge) : t.badge,
    }
  })
  res.json({ tiers })
})

// PUT: set config cho 1 tier (mode + emoji/role_id)
router.put('/:minLevel', (req, res) => {
  const minLevel = Number(req.params.minLevel)
  const { mode, badge, role_id } = req.body
  const tierExists = LEVEL_TIERS.find(t => t.minLevel === minLevel)
  if (!tierExists) return res.status(400).json({ error: 'Tier khong hop le' })

  if (mode === 'role') {
    if (!role_id || !/^\d{15,25}$/.test(String(role_id))) {
      return res.status(400).json({ error: 'role_id phai la Discord snowflake hop le' })
    }
    // Giu nguyen icon_url cu (neu admin chua upload moi)
    const existing = db.getTierBadgeOverrides(GUILD_ID()).get(minLevel)
    db.setTierBadge(GUILD_ID(), minLevel, {
      mode: 'role',
      badge: tierExists.badge, // fallback badge giu default
      role_id,
      icon_url: existing?.icon_url || null,
    })
    return res.json({ success: true })
  }

  // mode emoji (default)
  if (!isValidBadge(badge)) {
    return res.status(400).json({
      error: 'Emoji khong hop le. Chi chap nhan Unicode emoji.',
    })
  }
  db.setTierBadge(GUILD_ID(), minLevel, {
    mode: 'emoji',
    badge,
    role_id: null,
    icon_url: null,
  })
  res.json({ success: true })
})

// DELETE: reset 1 tier hoac all
router.delete('/:minLevel', (req, res) => {
  const param = req.params.minLevel
  if (param === 'all') {
    db.resetTierBadge(GUILD_ID(), null)
    return res.json({ success: true })
  }
  db.resetTierBadge(GUILD_ID(), Number(param))
  res.json({ success: true })
})

// POST /upload-icon: upload anh icon va push len Discord role qua API
// Body: form-data { image, min_level, role_id }
router.post('/upload-icon', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Khong co file' })
  const { min_level, role_id } = req.body
  if (!min_level || !role_id) return res.status(400).json({ error: 'min_level va role_id la bat buoc' })
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chua cau hinh' })

  const iconUrl = `/uploads/${req.file.filename}`
  const filePath = path.join(UPLOADS_DIR, req.file.filename)

  try {
    // Doc file va encode base64 data URI cho Discord API
    const buf = fs.readFileSync(filePath)
    const mime = req.file.mimetype
    const dataUri = `data:${mime};base64,${buf.toString('base64')}`

    // PATCH /guilds/{guild.id}/roles/{role.id} voi field icon
    const url = `https://discord.com/api/v10/guilds/${GUILD_ID()}/roles/${role_id}`
    const r = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bot ${process.env.BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ icon: dataUri }),
    })
    if (!r.ok) {
      const errText = await r.text()
      // Discord 403 thuong la khi server chua co Boost Level 2
      return res.status(r.status).json({
        error: `Discord API ${r.status}: ${errText.slice(0, 300)}`,
        hint: r.status === 403 || r.status === 400
          ? 'Co the server chua dat Boost Level 2 (can ≥7 boost de upload role icon).'
          : undefined,
      })
    }

    // Luu icon_url vao DB
    const existing = db.getTierBadgeOverrides(GUILD_ID()).get(Number(min_level))
    db.setTierBadge(GUILD_ID(), Number(min_level), {
      mode: 'role',
      badge: existing?.badge || '',
      role_id,
      icon_url: iconUrl,
    })

    res.json({ success: true, icon_url: iconUrl })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /test: gui test message vao channel de preview
router.post('/test', async (req, res) => {
  const { channel_id, min_level } = req.body
  if (!channel_id) return res.status(400).json({ error: 'channel_id la bat buoc' })
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chua cau hinh' })

  const guildId = GUILD_ID()
  const tier = LEVEL_TIERS.find(t => t.minLevel === Number(min_level)) || LEVEL_TIERS[0]
  const cfg = getTierConfig(guildId, tier)
  const isRole = cfg.mode === 'role'

  let description
  if (isRole) {
    description = `Tier **${tier.name}** (lv ${tier.minLevel}+) — Mode: **Role Icon**\n` +
      `Bot sẽ gán role <@&${cfg.role_id}> cho member khi lên tier này.\n` +
      `Icon role sẽ tự hiển thị cạnh tên trong chat (Discord native).`
  } else {
    const sampleNick = buildFlairNickname('TestUser', cfg.badge)
    description = `Tier **${tier.name}** (lv ${tier.minLevel}+) — Mode: **Emoji**\n` +
      `Emoji **${cfg.badge}** kèm tên.\nNickname mẫu:\n\`\`\`${sampleNick}\`\`\``
  }

  const embed = {
    title: '🎖️ Tier Flair Preview',
    description,
    color: tier.color,
    timestamp: new Date().toISOString(),
  }

  try {
    const r = await fetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${process.env.BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: '**[TEST Flair Preview]**', embeds: [embed] }),
    })
    if (!r.ok) {
      const errText = await r.text()
      return res.status(r.status).json({ error: `Discord API ${r.status}: ${errText.slice(0, 300)}` })
    }
    res.json({ success: true, sample: isRole ? `<@&${cfg.role_id}>` : buildFlairNickname('TestUser', cfg.badge) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
