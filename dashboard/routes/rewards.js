const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const db = require('../../shared/db')
const { pushRoleIcon } = require('../../shared/discord-role-icon')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../..')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

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

// POST /push-role-icon: dung anh badge da upload (badge_url) lam icon cua role
// kem theo (role_id). Reuse logic flair: PATCH Discord role icon qua API.
// Body: { badge_url: '/uploads/xxx.png', role_id: '12345...' }
router.post('/push-role-icon', async (req, res) => {
  const { badge_url, role_id } = req.body
  if (!badge_url || !role_id) return res.status(400).json({ error: 'badge_url va role_id la bat buoc' })
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chua cau hinh' })

  // badge_url co dang '/uploads/xxx.png' -> resolve absolute path
  const filename = path.basename(badge_url)
  const filePath = path.join(UPLOADS_DIR, filename)

  const result = await pushRoleIcon({
    guildId: GUILD_ID(),
    roleId: role_id,
    filePath,
    botToken: process.env.BOT_TOKEN,
  })
  if (!result.ok) return res.status(result.status).json({ error: result.error, hint: result.hint })
  res.json({ success: true })
})

// Gui test level-up embed cho 1 reward cu the (preview UI tren Discord)
// Reuse logic tu level-up-template/test, lay template hien tai tu DB
router.post('/test', async (req, res) => {
  const { channel_id, reward } = req.body
  if (!channel_id) return res.status(400).json({ error: 'channel_id la bat buoc' })
  if (!reward || !reward.level_required) return res.status(400).json({ error: 'reward + level_required la bat buoc' })
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chua duoc cau hinh' })

  const guildId = GUILD_ID()
  const tpl = db.getLevelUpTemplate(guildId)
  const lvl = Number(reward.level_required)
  const fakeXp = lvl * 1000

  // Test reward = reward dang preview (chua luu) hoac db record
  const isBadge = reward.type === 'badge'
  const rewardName = isBadge ? (reward.badge_name || 'Badge') : (reward.role_id ? `<@&${reward.role_id}>` : '')

  const fill = (str) => (str || '')
    .replace(/\{user\}/g, 'TestUser')
    .replace(/\{level\}/g, String(lvl))
    .replace(/\{xp\}/g, fakeXp.toLocaleString())
    .replace(/\{reward\}/g, isBadge ? (reward.badge_name || 'Badge') : (rewardName || 'Role'))
    .replace(/\{tier(_badge)?\}/g, '')

  const color = tpl.color_mode === 'custom'
    ? parseInt((tpl.custom_color || '#6366f1').replace('#', ''), 16)
    : 0x6366f1

  const embed = {
    title: fill(tpl.title),
    description: fill(tpl.milestone_description),
    color,
    timestamp: new Date().toISOString(),
  }

  if (tpl.show_avatar) {
    embed.thumbnail = { url: 'https://cdn.discordapp.com/embed/avatars/0.png' }
  }

  const fields = []
  if (tpl.show_tier_field) {
    const valueName = isBadge ? (reward.badge_name || 'Badge') : 'Role'
    fields.push({ name: 'Phan thuong', value: valueName, inline: true })
  }
  if (tpl.show_xp_field) fields.push({ name: 'Tong XP', value: `${fakeXp.toLocaleString()} XP`, inline: true })
  if (tpl.show_progress_field) fields.push({ name: 'Tien do', value: '[█████░░░░░] 50%', inline: true })

  if (tpl.show_role_reward && reward.role_id) {
    fields.push({ name: '🏅 Nhan duoc role', value: `<@&${reward.role_id}>`, inline: false })
  }

  if (tpl.show_badge_reward && isBadge) {
    fields.push({ name: '🖼️ Huy hieu moi', value: reward.badge_name || 'Badge', inline: false })
    if (tpl.show_badge_image && reward.badge_url) {
      const base = process.env.BASE_URL || ''
      if (base) embed.image = { url: `${base}${reward.badge_url}` }
    }
  }

  if (fields.length) embed.fields = fields

  const body = {
    content: tpl.mention_user ? '**[TEST]** @TestUser' : '**[TEST Reward preview]**',
    embeds: [embed],
  }

  try {
    const r = await fetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${process.env.BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
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
