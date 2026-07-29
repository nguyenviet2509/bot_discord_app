// Dashboard REST API cho BlessCastle Management.
// Endpoints:
//   GET  /api/blesscastle/config
//   PUT  /api/blesscastle/config
//   GET  /api/blesscastle/members
//   POST /api/blesscastle/attendance   body: {userId}
//   DELETE /api/blesscastle/attendance body: {userId}
//   POST /api/blesscastle/redeem       body: {userId}
//   GET  /api/blesscastle/redemptions
//   GET  /api/blesscastle/voice-channels

const https = require('https')
const express = require('express')
const bcDb = require('../../shared/db-blesscastle')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

// ================= Discord helpers =================

function discordApi(path) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'discord.com',
        path,
        method: 'GET',
        headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` },
      },
      (res) => {
        let data = ''
        res.on('data', (c) => { data += c })
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch (_) { resolve(null) }
        })
      }
    )
    req.on('error', () => resolve(null))
    req.end()
  })
}

async function fetchGuildMembersMap(guildId, { includeBots = false } = {}) {
  const arr = await discordApi(`/api/v10/guilds/${guildId}/members?limit=1000`)
  const map = new Map()
  if (Array.isArray(arr)) {
    for (const m of arr) {
      if (!m.user) continue
      if (!includeBots && m.user.bot) continue
      map.set(m.user.id, {
        username: m.nick || m.user.global_name || m.user.username,
        avatar: m.user.avatar,
        isBot: !!m.user.bot,
      })
    }
  }
  return map
}

async function fetchVoiceChannels(guildId) {
  const arr = await discordApi(`/api/v10/guilds/${guildId}/channels`)
  if (!Array.isArray(arr)) return []
  // channel type: 2 = GUILD_VOICE, 13 = GUILD_STAGE_VOICE
  return arr.filter(c => c.type === 2 || c.type === 13).map(c => ({ id: c.id, name: c.name }))
}

function avatarUrl(userId, hash) {
  if (!hash) return `https://cdn.discordapp.com/embed/avatars/${(BigInt(userId) >> 22n) % 6n}.png`
  return `https://cdn.discordapp.com/avatars/${userId}/${hash}.png?size=64`
}

// ================= Routes =================

router.get('/config', (req, res) => {
  res.json(bcDb.getConfig(GUILD_ID()))
})

router.put('/config', (req, res) => {
  const { voiceChannelIds, minMinutes, sessionStartHour, sessionEndHour, enabled } = req.body || {}
  const patch = {}
  if (Array.isArray(voiceChannelIds)) patch.voiceChannelIds = voiceChannelIds.map(String)
  if (Number.isInteger(minMinutes) && minMinutes >= 1 && minMinutes <= 180) patch.minMinutes = minMinutes
  if (Number.isInteger(sessionStartHour) && sessionStartHour >= 0 && sessionStartHour <= 23) patch.sessionStartHour = sessionStartHour
  if (Number.isInteger(sessionEndHour) && sessionEndHour >= 0 && sessionEndHour <= 23) patch.sessionEndHour = sessionEndHour
  if (typeof enabled === 'boolean') patch.enabled = enabled
  if (patch.sessionStartHour !== undefined && patch.sessionEndHour !== undefined
      && patch.sessionEndHour <= patch.sessionStartHour) {
    return res.status(400).json({ error: 'session_end_hour phai lon hon session_start_hour' })
  }
  const cfg = bcDb.upsertConfig(GUILD_ID(), patch)
  res.json(cfg)
})

router.get('/voice-channels', async (req, res) => {
  const channels = await fetchVoiceChannels(GUILD_ID())
  res.json(channels)
})

router.get('/members', async (req, res) => {
  const guildId = GUILD_ID()
  const cfg = bcDb.getConfig(guildId)
  const currentWeek = bcDb.currentWeekKey()
  const weekKey = (req.query.weekKey && /^\d{4}-\d{2}$/.test(req.query.weekKey)) ? req.query.weekKey : currentWeek
  const isCurrentWeek = weekKey === currentWeek
  const stars = bcDb.listActiveStars(guildId)
  const attRows = bcDb.getWeekAttendance(guildId, weekKey)
  const attMap = new Map(attRows.map(r => [r.user_id, r]))
  const members = await fetchGuildMembersMap(guildId)  // KHONG include bots
  const minSec = cfg.minMinutes * 60

  function weekView(att) {
    return {
      voiceSeconds: att.voice_seconds,
      voiceMinutes: Math.floor(att.voice_seconds / 60),
      attendedManual: !!att.attended_manual,
      achieved: !!att.attended_manual || att.voice_seconds >= minSec,
    }
  }

  const result = []

  // 1. Stars rows (chi user thuc, khong bot)
  for (const s of stars) {
    if (!members.has(s.user_id)) continue // skip bot hoac user da roi guild
    const info = members.get(s.user_id)
    const att = attMap.get(s.user_id) || { voice_seconds: 0, attended_manual: 0 }
    result.push({
      userId: s.user_id,
      username: info.username,
      avatar: avatarUrl(s.user_id, info.avatar),
      stars: s.stars,
      lastUpdated: s.last_updated,
      thisWeek: weekView(att),
    })
  }

  // 2. Attendance-only rows (chua co stars, nhung co attendance tuan dang xem)
  for (const att of attRows) {
    if (result.find(r => r.userId === att.user_id)) continue
    if (!members.has(att.user_id)) continue // skip bot / da roi
    const info = members.get(att.user_id)
    result.push({
      userId: att.user_id,
      username: info.username,
      avatar: avatarUrl(att.user_id, info.avatar),
      stars: 0,
      lastUpdated: null,
      thisWeek: weekView(att),
    })
  }

  // 3. Only current week: them TAT CA member thuc trong guild de admin co the tick manual
  if (isCurrentWeek) {
    for (const [uid, info] of members) {
      if (result.find(r => r.userId === uid)) continue
      result.push({
        userId: uid,
        username: info.username,
        avatar: avatarUrl(uid, info.avatar),
        stars: 0,
        lastUpdated: null,
        thisWeek: { voiceSeconds: 0, voiceMinutes: 0, attendedManual: false, achieved: false },
      })
    }
  }

  // Sort: achieved DESC, stars DESC, username
  result.sort((a, b) => {
    if (b.thisWeek.achieved !== a.thisWeek.achieved) return b.thisWeek.achieved ? 1 : -1
    if (b.stars !== a.stars) return b.stars - a.stars
    return a.username.localeCompare(b.username)
  })

  res.json({ weekKey, currentWeek, isCurrentWeek, minMinutes: cfg.minMinutes, members: result })
})

router.get('/weeks', (req, res) => {
  const limit = Math.min(52, parseInt(req.query.limit) || 20)
  const rows = bcDb.listWeeks(GUILD_ID(), limit).map(r => ({
    weekKey: r.week_key,
    total: r.total,
    manualCount: r.manual_count,
    finalizedCount: r.finalized_count,
  }))
  const current = bcDb.currentWeekKey()
  if (!rows.find(r => r.weekKey === current)) {
    rows.unshift({ weekKey: current, total: 0, manualCount: 0, finalizedCount: 0 })
  }
  res.json(rows)
})

router.post('/reset', (req, res) => {
  const { confirm } = req.body || {}
  if (confirm !== 'RESET') {
    return res.status(400).json({ error: 'Missing confirmation. Send { "confirm": "RESET" }' })
  }
  bcDb.resetAllData(GUILD_ID())
  res.json({ ok: true, message: 'Da xoa toan bo du lieu BlessCastle (giu lai cau hinh)' })
})

router.post('/attendance', (req, res) => {
  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId bat buoc' })
  if (!bcDb.isInManualWindow()) {
    return res.status(400).json({ error: 'Chi co the diem danh thu cong tu T2 den 19h thu 6 (gio Saigon)' })
  }
  bcDb.setManualAttendance(GUILD_ID(), userId, bcDb.currentWeekKey(), 1)
  res.json({ ok: true })
})

router.delete('/attendance', (req, res) => {
  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId bat buoc' })
  if (!bcDb.isInManualWindow()) {
    return res.status(400).json({ error: 'Chi co the diem danh thu cong tu T2 den 19h thu 6 (gio Saigon)' })
  }
  bcDb.setManualAttendance(GUILD_ID(), userId, bcDb.currentWeekKey(), 0)
  res.json({ ok: true })
})

router.post('/redeem', (req, res) => {
  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId bat buoc' })
  const guildId = GUILD_ID()
  const stars = bcDb.getStars(guildId, userId)
  if (stars < 3) return res.status(400).json({ error: `Member chua du 3 sao (hien co ${stars})` })
  const adminId = req.user?.id || 'system'
  bcDb.createRedemption(guildId, userId, adminId, stars)
  res.json({ ok: true })
})

router.get('/redemptions', async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit) || 50)
  const guildId = GUILD_ID()
  const rows = bcDb.listRedemptions(guildId, limit)
  const members = await fetchGuildMembersMap(guildId)
  const enriched = rows.map(r => {
    const info = members.get(r.user_id) || { username: `User ${r.user_id.slice(-4)}`, avatar: null }
    return {
      id: r.id,
      userId: r.user_id,
      username: info.username,
      avatar: avatarUrl(r.user_id, info.avatar),
      adminId: r.admin_id,
      redeemedAt: r.redeemed_at,
      starsAtRedemption: r.stars_at_redemption,
    }
  })
  res.json(enriched)
})

module.exports = router
