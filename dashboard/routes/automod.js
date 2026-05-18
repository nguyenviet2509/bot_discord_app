// Dashboard routes cho module Auto-Mod Lite.
// Pattern: single-guild, lay guild_id tu env (GUILD_ID), tuong tu honor.js.

const express = require('express')
const dbAutomod = require('../../shared/db-automod')
const badWordCache = require('../../bot/src/modules/auto-mod/bad-word-cache')

const router = express.Router()
const GUILD = () => process.env.GUILD_ID
const BOT_TOKEN = () => process.env.BOT_TOKEN

const VALID_RULES = ['anti-spam', 'anti-invite', 'bad-word', 'anti-mass-mention', 'anti-repeat']
const VALID_ACTIONS = ['warn', 'mute-5m', 'mute-1h', 'mute-1d', 'kick']

// ============================================================
// Config
// ============================================================

// GET /api/automod/config — toan bo config cua 5 rule
router.get('/config', (req, res) => {
  const cfg = dbAutomod.getConfig(GUILD())
  // Dam bao tra ve du 5 rule (rule chua co row -> default disabled)
  const out = {}
  for (const r of VALID_RULES) {
    out[r] = cfg[r] || { enabled: false, params: {} }
  }
  res.json(out)
})

// PUT /api/automod/config/:rule — update 1 rule
router.put('/config/:rule', (req, res) => {
  const rule = req.params.rule
  if (!VALID_RULES.includes(rule)) return res.status(400).json({ error: 'Rule khong hop le' })
  const { enabled, params } = req.body || {}
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled phai la boolean' })

  // Validate params theo tung rule
  const safeParams = sanitizeParams(rule, params || {})
  dbAutomod.upsertRuleConfig(GUILD(), rule, enabled, safeParams)

  // Invalidate bad-word cache khi config bad-word doi
  if (rule === 'bad-word') badWordCache.invalidate(GUILD())

  res.json({ success: true })
})

function sanitizeParams(rule, params) {
  switch (rule) {
    case 'anti-spam': {
      const m = Math.max(2, Math.min(50, Number(params.maxMessages) || 5))
      const w = Math.max(2, Math.min(60, Number(params.windowSec) || 5))
      return { maxMessages: m, windowSec: w }
    }
    case 'anti-mass-mention': {
      const m = Math.max(2, Math.min(50, Number(params.maxMentions) || 5))
      return { maxMentions: m }
    }
    case 'anti-repeat': {
      const r = Math.max(2, Math.min(20, Number(params.maxRepeats) || 3))
      return { maxRepeats: r }
    }
    case 'bad-word': {
      const words = Array.isArray(params.words) ? params.words : []
      return { words: words.slice(0, 500).map(w => String(w).slice(0, 100)).filter(w => w.trim().length > 0) }
    }
    default:
      return {}
  }
}

// ============================================================
// Whitelist
// ============================================================

router.get('/whitelist', (req, res) => {
  res.json(dbAutomod.listWhitelist(GUILD()))
})

router.post('/whitelist', (req, res) => {
  const { type, id } = req.body || {}
  if (type !== 'channel' && type !== 'role') return res.status(400).json({ error: 'type phai la channel hoac role' })
  if (!id || !/^\d{17,20}$/.test(String(id))) return res.status(400).json({ error: 'id Discord khong hop le' })
  dbAutomod.addWhitelist(GUILD(), type, id)
  res.json({ success: true })
})

router.delete('/whitelist/:type/:id', (req, res) => {
  const { type, id } = req.params
  if (type !== 'channel' && type !== 'role') return res.status(400).json({ error: 'type khong hop le' })
  dbAutomod.removeWhitelist(GUILD(), type, id)
  res.json({ success: true })
})

// ============================================================
// Ladder (luu vao automod_config voi rule_name='__ladder__')
// ============================================================

router.get('/ladder', (req, res) => {
  const cfg = dbAutomod.getRuleConfig(GUILD(), '__ladder__')
  const ladder = (cfg && cfg.params) || { steps: ['warn', 'mute-5m', 'mute-1h', 'kick'], expirySec: 86400 }
  res.json(ladder)
})

router.put('/ladder', (req, res) => {
  const { steps, expirySec } = req.body || {}
  if (!Array.isArray(steps) || steps.length === 0) return res.status(400).json({ error: 'steps phai la mang khong rong' })
  const safeSteps = steps.slice(0, 8).map(s => String(s)).filter(s => VALID_ACTIONS.includes(s))
  if (safeSteps.length === 0) return res.status(400).json({ error: 'Khong co action hop le' })
  const safeExpiry = Math.max(3600, Math.min(7 * 86400, Number(expirySec) || 86400))
  dbAutomod.upsertRuleConfig(GUILD(), '__ladder__', true, { steps: safeSteps, expirySec: safeExpiry })
  res.json({ success: true })
})

// ============================================================
// Channels & Roles proxy (de UI chon whitelist)
// ============================================================

let _channelsCache = { ts: 0, data: null }
let _rolesCache = { ts: 0, data: null }
const CACHE_TTL_MS = 60 * 1000

router.get('/channels', async (req, res) => {
  if (_channelsCache.data && Date.now() - _channelsCache.ts < CACHE_TTL_MS) {
    return res.json(_channelsCache.data)
  }
  try {
    const r = await fetch(`https://discord.com/api/v10/guilds/${GUILD()}/channels`, {
      headers: { Authorization: `Bot ${BOT_TOKEN()}` },
    })
    if (!r.ok) return res.status(502).json({ error: 'Discord API loi' })
    const arr = await r.json()
    const data = arr
      .filter(c => c.type === 0 || c.type === 5) // text + announcement
      .map(c => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
    _channelsCache = { ts: Date.now(), data }
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/roles', async (req, res) => {
  if (_rolesCache.data && Date.now() - _rolesCache.ts < CACHE_TTL_MS) {
    return res.json(_rolesCache.data)
  }
  try {
    const r = await fetch(`https://discord.com/api/v10/guilds/${GUILD()}/roles`, {
      headers: { Authorization: `Bot ${BOT_TOKEN()}` },
    })
    if (!r.ok) return res.status(502).json({ error: 'Discord API loi' })
    const arr = await r.json()
    const data = arr
      .filter(r => r.name !== '@everyone' && !r.managed)
      .map(r => ({ id: r.id, name: r.name, color: r.color }))
      .sort((a, b) => a.name.localeCompare(b.name))
    _rolesCache = { ts: Date.now(), data }
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// Logs + Warns + Stats (phase 5)
// ============================================================

router.get('/logs', (req, res) => {
  const { user, rule, action, from, to } = req.query
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.max(10, Math.min(100, Number(req.query.pageSize) || 20))
  const offset = (page - 1) * pageSize
  const filter = {
    userId: user || undefined,
    rule: rule || undefined,
    action: action || undefined,
    from: from ? Number(from) : undefined,
    to: to ? Number(to) : undefined,
  }
  const rows = dbAutomod.listLogs(GUILD(), { ...filter, limit: pageSize, offset })
  const total = dbAutomod.countLogs(GUILD(), filter)
  res.json({ rows, total, page, pageSize })
})

router.get('/warns/:userId', (req, res) => {
  const userId = req.params.userId
  const count = dbAutomod.countActiveWarns(GUILD(), userId, 86400)
  res.json({ userId, count })
})

router.delete('/warns/:userId', (req, res) => {
  dbAutomod.clearWarns(GUILD(), req.params.userId)
  res.json({ success: true })
})

router.get('/stats', (req, res) => {
  const days = Math.max(1, Math.min(30, Number(req.query.days) || 7))
  res.json({
    byRule: dbAutomod.getStatsByRule(GUILD(), days),
    topOffenders: dbAutomod.getTopOffenders(GUILD(), days, 10),
    days,
  })
})

module.exports = router
