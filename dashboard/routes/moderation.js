const express = require('express')
const db = require('../../shared/db')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

// Cache guild members theo userId -> displayName (TTL 5 phut)
const memberNameCache = { map: null, expiresAt: 0 }

async function getMemberNameMap(guildId) {
  const now = Date.now()
  if (memberNameCache.map && memberNameCache.expiresAt > now) return memberNameCache.map
  if (!process.env.BOT_TOKEN) return new Map()
  try {
    const map = new Map()
    let after = '0'
    for (let i = 0; i < 10; i++) {
      const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`, {
        headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` },
      })
      if (!r.ok) break
      const arr = await r.json()
      if (!Array.isArray(arr) || arr.length === 0) break
      for (const m of arr) {
        if (!m.user?.id) continue
        const name = m.nick || m.user.global_name || m.user.username
        if (name) map.set(m.user.id, name)
      }
      if (arr.length < 1000) break
      after = arr[arr.length - 1].user.id
    }
    memberNameCache.map = map
    memberNameCache.expiresAt = now + 5 * 60 * 1000
    return map
  } catch (e) {
    return memberNameCache.map || new Map()
  }
}

function enrichWithNames(rows, nameMap) {
  if (!rows || !nameMap || nameMap.size === 0) return rows
  return rows.map(r => {
    const out = { ...r }
    const fresh = nameMap.get(r.user_id)
    if (fresh) out.user_tag = fresh
    const modFresh = r.moderator_id ? nameMap.get(r.moderator_id) : null
    if (modFresh) out.moderator_tag = modFresh
    return out
  })
}

// List all moderation actions (filterable)
router.get('/', async (req, res) => {
  const { action_type, search, page = '1', limit = '50' } = req.query
  const limitNum = Math.min(Number(limit) || 50, 200)
  const pageNum = Math.max(Number(page) || 1, 1)
  const offset = (pageNum - 1) * limitNum

  const guildId = GUILD_ID()
  const actions = db.getModActions(guildId, { action_type, search, limit: limitNum, offset })
  const total = db.countModActions(guildId, { action_type, search })
  const activeBans = db.getActiveBans(guildId)
  const nameMap = await getMemberNameMap(guildId)
  res.json({
    actions: enrichWithNames(actions, nameMap),
    total, page: pageNum, limit: limitNum,
    active_bans: enrichWithNames(activeBans, nameMap),
  })
})

// Unban from dashboard
router.post('/unban', async (req, res) => {
  const { user_id, reason } = req.body
  if (!user_id) return res.status(400).json({ error: 'user_id la bat buoc' })
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chua duoc cau hinh' })

  const guildId = GUILD_ID()
  const reasonStr = reason || 'Unban từ dashboard'

  try {
    // Goi Discord REST API
    const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/bans/${user_id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bot ${process.env.BOT_TOKEN}`,
        'X-Audit-Log-Reason': reasonStr,
      },
    })
    if (!r.ok && r.status !== 404) {
      const errText = await r.text()
      return res.status(r.status).json({ error: `Discord API ${r.status}: ${errText.slice(0, 300)}` })
    }
    db.removeTempBan(guildId, user_id)
    db.logModAction({
      guild_id: guildId,
      action_type: 'unban',
      user_id,
      user_tag: null,
      user_avatar: null,
      moderator_id: null,
      moderator_tag: 'Dashboard',
      reason: reasonStr,
      duration_ms: null,
      expires_at: null,
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// Command Usage (thong ke su dung slash command)
// ============================================================
// GET /command-usage?command_name=&user_id=&search=&page=&limit=&range=24h|7d|30d|all
router.get('/command-usage', (req, res) => {
  const { command_name, user_id, search, page = '1', limit = '50', range = '7d' } = req.query
  const limitNum = Math.min(Number(limit) || 50, 200)
  const pageNum = Math.max(Number(page) || 1, 1)
  const offset = (pageNum - 1) * limitNum

  const rangeMap = { '24h': 86400, '7d': 86400 * 7, '30d': 86400 * 30, 'all': 0 }
  const rangeSec = rangeMap[range] ?? rangeMap['7d']
  const sinceSec = rangeSec === 0 ? 0 : Math.floor(Date.now() / 1000) - rangeSec

  const guildId = GUILD_ID()
  const filters = { command_name, user_id, search, limit: limitNum, offset }
  const items = db.getCommandUsage(guildId, filters)
  const total = db.countCommandUsage(guildId, filters)
  const stats = db.getCommandUsageStats(guildId, sinceSec)

  res.json({
    items, total, page: pageNum, limit: limitNum,
    range, since: sinceSec,
    stats,
  })
})

module.exports = router
