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

async function fetchGuildMembersMap(guildId) {
  const arr = await discordApi(`/api/v10/guilds/${guildId}/members?limit=1000`)
  const map = new Map()
  if (Array.isArray(arr)) {
    for (const m of arr) {
      if (m.user) map.set(m.user.id, {
        username: m.nick || m.user.global_name || m.user.username,
        avatar: m.user.avatar,
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
  const weekKey = bcDb.currentWeekKey()
  const stars = bcDb.listActiveStars(guildId)
  const attRows = bcDb.getWeekAttendance(guildId, weekKey)
  const attMap = new Map(attRows.map(r => [r.user_id, r]))
  const members = await fetchGuildMembersMap(guildId)
  const minSec = cfg.minMinutes * 60

  const result = stars.map(s => {
    const info = members.get(s.user_id) || { username: `User ${s.user_id.slice(-4)}`, avatar: null }
    const att = attMap.get(s.user_id) || { voice_seconds: 0, attended_manual: 0 }
    return {
      userId: s.user_id,
      username: info.username,
      avatar: avatarUrl(s.user_id, info.avatar),
      stars: s.stars,
      lastUpdated: s.last_updated,
      thisWeek: {
        voiceSeconds: att.voice_seconds,
        voiceMinutes: Math.floor(att.voice_seconds / 60),
        attendedManual: !!att.attended_manual,
        achieved: !!att.attended_manual || att.voice_seconds >= minSec,
      },
    }
  })

  // Them member co attendance tuan nay nhung chua co stars row
  for (const att of attRows) {
    if (result.find(r => r.userId === att.user_id)) continue
    const info = members.get(att.user_id) || { username: `User ${att.user_id.slice(-4)}`, avatar: null }
    result.push({
      userId: att.user_id,
      username: info.username,
      avatar: avatarUrl(att.user_id, info.avatar),
      stars: 0,
      lastUpdated: null,
      thisWeek: {
        voiceSeconds: att.voice_seconds,
        voiceMinutes: Math.floor(att.voice_seconds / 60),
        attendedManual: !!att.attended_manual,
        achieved: !!att.attended_manual || att.voice_seconds >= minSec,
      },
    })
  }

  // Them TAT CA member trong guild (de admin co the tick manual cho ai chua co stars/attendance)
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

  // Sort: stars DESC, then achieved DESC, then username
  result.sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars
    if (b.thisWeek.achieved !== a.thisWeek.achieved) return b.thisWeek.achieved ? 1 : -1
    return a.username.localeCompare(b.username)
  })

  res.json({ weekKey, minMinutes: cfg.minMinutes, members: result })
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
