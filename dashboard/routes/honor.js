// Dashboard routes cho tinh nang vinh danh
const express = require('express')
const dbHonor = require('../../shared/db-honor')
const { buildHonorEmbed } = require('../../shared/build-honor-embed')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

// GET /api/honor/settings — lay role/channel config hien tai
router.get('/settings', (req, res) => {
  const settings = dbHonor.getHonorSettings(GUILD_ID())
  res.json(settings)
})

// PUT /api/honor/settings — luu cau hinh
router.put('/settings', (req, res) => {
  const { allowed_role_ids, default_channel_id } = req.body
  if (allowed_role_ids !== undefined && !Array.isArray(allowed_role_ids)) {
    return res.status(400).json({ error: 'allowed_role_ids phải là mảng' })
  }
  dbHonor.upsertHonorSettings({
    guild_id: GUILD_ID(),
    allowed_role_ids: allowed_role_ids || [],
    default_channel_id: default_channel_id || null,
  })
  res.json({ success: true })
})

// GET /api/honor/history?limit=10
router.get('/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50)
  const records = dbHonor.listHonorHistory(GUILD_ID(), limit)
  res.json(records)
})

// POST /api/honor/preview — render thu embed cho dashboard preview
router.post('/preview', (req, res) => {
  try {
    const payload = buildHonorEmbed(req.body)
    res.json(payload)
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

module.exports = router
