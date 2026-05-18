// Dashboard routes cho tinh nang vinh danh
const express = require('express')
const dbHonor = require('../../shared/db-honor')
const { buildHonorEmbed } = require('../../shared/build-honor-embed')
const { buildHonorTeamEmbed } = require('../../shared/build-honor-team-embed')

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

// GET /api/honor/team-history?limit=10
router.get('/team-history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50)
  const records = dbHonor.listHonorTeamHistory(GUILD_ID(), limit)
  res.json(records)
})

// POST /api/honor/preview — render thu embed cho dashboard preview
// Body: { type: 'top3'|'team', ...payload }
router.post('/preview', (req, res) => {
  try {
    const { type, ...payload } = req.body
    const result = type === 'team' ? buildHonorTeamEmbed(payload) : buildHonorEmbed(payload)
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
    const built = type === 'team' ? buildHonorTeamEmbed(payload) : buildHonorEmbed(payload)
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

module.exports = router
