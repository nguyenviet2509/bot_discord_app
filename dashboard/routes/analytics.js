const express = require('express')
const db = require('../../shared/db')
const { scanSilentMembers } = require('../../shared/scan-silent-members')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

router.get('/summary', async (req, res) => {
  const summary = db.getAnalyticsSummary(GUILD_ID())
  // Fetch tong member that tu Discord (approximate, fast)
  try {
    if (process.env.BOT_TOKEN) {
      const r = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID()}?with_counts=true`, {
        headers: { 'Authorization': `Bot ${process.env.BOT_TOKEN}` },
      })
      if (r.ok) {
        const g = await r.json()
        summary.total_members_discord = g.approximate_member_count || null
      }
    }
  } catch (_) { /* fallback: chi co total_members tu DB */ }
  res.json(summary)
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

// ============================================================
// Silent member role filter config
// ============================================================
let rolesCache = { at: 0, data: null }
async function fetchGuildRoles() {
  if (Date.now() - rolesCache.at < 60_000 && rolesCache.data) return rolesCache.data
  if (!process.env.BOT_TOKEN) throw new Error('BOT_TOKEN chua duoc cau hinh')
  const r = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID()}/roles`, {
    headers: { 'Authorization': `Bot ${process.env.BOT_TOKEN}` },
  })
  if (!r.ok) throw new Error(`Discord API ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const roles = await r.json()
  rolesCache = { at: Date.now(), data: roles }
  return roles
}

router.get('/silent-filter-config', (req, res) => {
  res.json(db.getSilentFilterConfig(GUILD_ID()))
})

router.get('/guild-roles', async (req, res) => {
  try {
    const roles = await fetchGuildRoles()
    res.json(
      roles
        .filter(r => r.name !== '@everyone')
        .map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position }))
        .sort((a, b) => b.position - a.position)
    )
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/silent-filter-config', async (req, res) => {
  try {
    const { include_role_id, exclude_role_id } = req.body || {}
    const normInclude = include_role_id ? String(include_role_id) : null
    const normExclude = exclude_role_id ? String(exclude_role_id) : null

    // Validate role ton tai (warn only, khong hard fail)
    const warnings = []
    if (normInclude || normExclude) {
      try {
        const roles = await fetchGuildRoles()
        const ids = new Set(roles.map(r => r.id))
        if (normInclude && !ids.has(normInclude)) warnings.push(`Role include "${normInclude}" khong ton tai trong server`)
        if (normExclude && !ids.has(normExclude)) warnings.push(`Role exclude "${normExclude}" khong ton tai trong server`)
      } catch (_) { /* skip validation neu fetch fail */ }
    }

    db.setSilentFilterConfig(GUILD_ID(), { includeRoleId: normInclude, excludeRoleId: normExclude })
    const scan = await scanSilentMembers(GUILD_ID())
    res.json({
      success: true,
      config: db.getSilentFilterConfig(GUILD_ID()),
      scan,
      warnings,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
