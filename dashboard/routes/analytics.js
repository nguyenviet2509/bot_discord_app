const express = require('express')
const db = require('../../shared/db')
const { scanSilentMembers } = require('../../shared/scan-silent-members')

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

// GET: tra ve list silent member tu DB (instant)
router.get('/silent-members', (req, res) => {
  const guildId = GUILD_ID()
  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000)
  const members = db.getSilentMembers(guildId, limit).map(m => ({
    id: m.user_id,
    username: m.username,
    global_name: m.global_name,
    nickname: m.nickname,
    avatar: m.avatar,
    joined_at: m.joined_at,
  }))
  res.json({
    total: db.countSilentMembers(guildId),
    scanned_at: db.getSilentScannedAt(guildId),
    members,
  })
})

// POST: quet Discord + luu vao DB
router.post('/silent-members/scan', async (req, res) => {
  try {
    const result = await scanSilentMembers(GUILD_ID())
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
