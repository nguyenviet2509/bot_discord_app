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

module.exports = router
