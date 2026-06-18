const https = require('https')
const express = require('express')
const voiceStatsDb = require('../../shared/db-voice-stats')
const sharedDb = require('../../shared/db')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

// Fetch Discord members de cross-check user nao da roi server.
// Duplicate logic voi routes/members.js (KISS - chi 2 cho, khong dang extract module).
function fetchDiscordMembers(guildId) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'discord.com',
        path: `/api/v10/guilds/${guildId}/members?limit=1000`,
        method: 'GET',
        headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch (_) { resolve([]) }
        })
      }
    )
    req.on('error', () => resolve([]))
    req.end()
  })
}

// Reconcile: xoa user "ghost" (con voice_sessions / users record nhung khong con trong guild).
// Goi truoc khi build leaderboard de loai bo ghost ngay tu query.
async function reconcileGhosts(guildId) {
  const members = await fetchDiscordMembers(guildId)
  if (!Array.isArray(members) || members.length === 0) return 0

  const liveIds = new Set()
  for (const m of members) {
    if (m.user && m.user.id) liveIds.add(m.user.id)
  }

  // Lay tat ca user_id co trong voice_sessions
  const rows = sharedDb.getDb()
    .prepare('SELECT DISTINCT user_id FROM voice_sessions WHERE guild_id = ?')
    .all(guildId)

  let removed = 0
  for (const r of rows) {
    if (liveIds.has(r.user_id)) continue
    try {
      voiceStatsDb.deleteVoiceStats(guildId, r.user_id)
      sharedDb.deleteUser(r.user_id, guildId)
      sharedDb.logMemberEvent(guildId, r.user_id, 'leave')
      removed++
    } catch (err) {
      console.error('[voice-stats reconcile] cleanup fail:', r.user_id, err.message)
    }
  }
  if (removed > 0) console.log(`[voice-stats reconcile] removed ${removed} ghost users`)
  return removed
}

const RANGE_PRESETS = new Set(['today', '7d', '30d', 'all', 'custom'])
const SAIGON_OFFSET_SEC = 7 * 3600

function resolveRange(range, from, to) {
  const now = Math.floor(Date.now() / 1000)
  let f = 0, t = now, label = 'tat ca thoi gian'
  switch (range) {
    case 'today': {
      const saigonNow = now + SAIGON_OFFSET_SEC
      const startOfDaySaigon = Math.floor(saigonNow / 86400) * 86400
      f = startOfDaySaigon - SAIGON_OFFSET_SEC
      label = 'Hôm nay'
      break
    }
    case '7d':  f = now - 7 * 86400;  label = '7 ngày qua'; break
    case '30d': f = now - 30 * 86400; label = '30 ngày qua'; break
    case 'all': f = 0; label = 'Tất cả thời gian'; break
    case 'custom': {
      // from/to: ISO string hoac unix sec
      const parse = (v) => {
        if (v == null || v === '') return null
        const n = Number(v)
        if (!isNaN(n) && n > 0) return Math.floor(n)
        const d = new Date(String(v))
        return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000)
      }
      const pf = parse(from), pt = parse(to)
      if (pf != null) f = pf
      if (pt != null) t = pt
      label = 'Tùy chọn'
      break
    }
    default: break
  }
  return { from: f, to: t, label }
}

// Lookup display info tu bang users (level system). Tra ve fallback neu khong co.
function lookupUserDisplay(guildId, userId) {
  const u = sharedDb.getUser(userId, guildId)
  if (!u) return { display_name: `User ${userId.slice(-4)}`, avatar: null }
  const name = u.nickname || u.global_name || u.username || `User ${userId.slice(-4)}`
  const avatarUrl = u.avatar
    ? `https://cdn.discordapp.com/avatars/${userId}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=64`
    : null
  return { display_name: name, avatar: avatarUrl }
}

function lookupChannelName(channelId) {
  // Khong co Discord client trong dashboard → tra ve id, frontend co the resolve them qua /api/discord/channels
  return null
}

// GET /api/voice-stats?range=7d&from=&to=&limit=20
router.get('/', async (req, res) => {
  const guildId = GUILD_ID()
  const range = String(req.query.range || '7d').toLowerCase()
  if (!RANGE_PRESETS.has(range)) {
    return res.status(400).json({ error: `range phải là một trong: ${[...RANGE_PRESETS].join(', ')}` })
  }
  let limit = parseInt(req.query.limit, 10) || 500
  if (limit < 5) limit = 5
  if (limit > 1000) limit = 1000

  const { from, to, label } = resolveRange(range, req.query.from, req.query.to)
  if (from >= to) return res.status(400).json({ error: 'Khoảng thời gian không hợp lệ (from >= to)' })

  // Dọn ghost members truoc khi query leaderboard
  await reconcileGhosts(guildId)

  const rows = voiceStatsDb.getLeaderboard(guildId, from, to, limit)
  const leaderboard = rows.map(r => {
    const disp = lookupUserDisplay(guildId, r.user_id)
    const topCh = voiceStatsDb.getTopChannelForUser(guildId, r.user_id, from, to)
    return {
      user_id: r.user_id,
      display_name: disp.display_name,
      avatar_url: disp.avatar,
      total_sec: r.total_sec || 0,
      join_count: r.join_count || 0,
      top_channel: topCh ? { id: topCh.channel_id, name: lookupChannelName(topCh.channel_id), total_sec: topCh.total_sec } : null,
    }
  })

  res.json({
    range: { from, to, label, key: range },
    leaderboard,
    enabled: voiceStatsDb.isVoiceStatsEnabled(guildId),
  })
})

// GET /api/voice-stats/settings
router.get('/settings', (req, res) => {
  res.json({ voice_stats_enabled: voiceStatsDb.isVoiceStatsEnabled(GUILD_ID()) })
})

// PUT /api/voice-stats/settings { voice_stats_enabled: bool }
router.put('/settings', (req, res) => {
  const enabled = !!(req.body && req.body.voice_stats_enabled)
  voiceStatsDb.setVoiceStatsEnabled(GUILD_ID(), enabled)
  res.json({ success: true, voice_stats_enabled: enabled })
})

module.exports = router
