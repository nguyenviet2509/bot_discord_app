const express = require('express')
const db = require('../../shared/db')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

router.get('/summary', (req, res) => {
  res.json(db.getAnalyticsSummary(GUILD_ID()))
})

router.get('/growth', (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)
  res.json(db.getMemberGrowth(GUILD_ID(), days))
})

router.get('/heatmap', (req, res) => {
  res.json(db.getActivityHeatmap(GUILD_ID()))
})

router.get('/top-channels', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50)
  res.json(db.getTopChannels(GUILD_ID(), limit))
})

router.get('/inactive', (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 365)
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500)
  res.json(db.getInactiveMembers(GUILD_ID(), days, limit))
})

// Member co trong server nhung chua chat lan nao
router.get('/silent-members', async (req, res) => {
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chua duoc cau hinh' })
  const guildId = GUILD_ID()
  const limitOut = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000)

  try {
    // Fetch member list tu Discord (max 1000/page, paginate by after)
    const allMembers = []
    let after = '0'
    for (let i = 0; i < 10; i++) { // tối đa 10 trang = 10k member
      const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`, {
        headers: { 'Authorization': `Bot ${process.env.BOT_TOKEN}` },
      })
      if (!r.ok) {
        const errText = await r.text()
        return res.status(r.status).json({ error: `Discord API ${r.status}: ${errText.slice(0, 200)}` })
      }
      const batch = await r.json()
      if (!batch.length) break
      allMembers.push(...batch)
      after = batch[batch.length - 1].user.id
      if (batch.length < 1000) break
    }

    // Set cac user_id da chat (co trong users table cho guild nay)
    const chattedIds = new Set(
      db.getAllUsers ? db.getAllUsers(guildId).map(u => u.id) : []
    )

    // Loc: member khong phai bot + chua chat
    const silent = allMembers
      .filter(m => m.user && !m.user.bot && !chattedIds.has(m.user.id))
      .map(m => ({
        id: m.user.id,
        username: m.user.username,
        global_name: m.user.global_name || null,
        nickname: m.nick || null,
        avatar: m.user.avatar || null,
        joined_at: m.joined_at,
      }))
      .sort((a, b) => new Date(b.joined_at) - new Date(a.joined_at))

    res.json({ total: silent.length, members: silent.slice(0, limitOut) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
