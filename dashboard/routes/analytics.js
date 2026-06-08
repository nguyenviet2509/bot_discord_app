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

// Get/Set notify template (channel + noi dung) — persist tren DB
router.get('/silent-notify-config', (req, res) => {
  res.json(db.getSilentNotifyConfig(GUILD_ID()))
})

router.put('/silent-notify-config', (req, res) => {
  const { channel_id, message } = req.body || {}
  db.setSilentNotifyConfig(GUILD_ID(), {
    channelId: channel_id ? String(channel_id).trim() : null,
    message: message != null ? String(message) : null,
  })
  res.json({ success: true, config: db.getSilentNotifyConfig(GUILD_ID()) })
})

// POST: kick member khoi server
// Body: { user_ids: string[] | 'all' }
// SAFETY: chi kick member co trong bang silent_members (da pass filter Whitelisted khi scan)
router.post('/silent-members/kick', async (req, res) => {
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chưa được cấu hình' })
  const guildId = GUILD_ID()
  const { user_ids } = req.body || {}

  // Lay whitelist tu DB - ID nay deu da pass filter role cua user
  const silentList = db.getSilentMembers(guildId, 1000)
  const allowedIds = new Set(silentList.map(m => m.user_id))

  let targetIds
  if (user_ids === 'all') {
    targetIds = silentList.map(m => m.user_id)
  } else if (Array.isArray(user_ids) && user_ids.length > 0) {
    // Chi giu lai nhung ID nam trong silent list (safety)
    targetIds = user_ids.map(String).filter(id => allowedIds.has(id))
  } else {
    return res.status(400).json({ error: 'Thiếu user_ids hoặc rỗng' })
  }

  if (targetIds.length === 0) {
    return res.status(400).json({ error: 'Không có member hợp lệ để kick (phải nằm trong list silent đã filter)' })
  }

  const results = { kicked: 0, failed: 0, total: targetIds.length, errors: [] }
  for (let i = 0; i < targetIds.length; i++) {
    const uid = targetIds[i]
    try {
      const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${uid}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bot ${process.env.BOT_TOKEN}`,
          'X-Audit-Log-Reason': 'Silent member - dashboard kick',
        },
      })
      if (r.ok || r.status === 204) {
        results.kicked++
        // Xoa khoi silent_members table de UI dong bo
        try { db.removeSilentMember(guildId, uid) } catch (_) {}
      } else {
        const txt = await r.text()
        results.failed++
        results.errors.push(`${uid}: ${r.status} ${txt.slice(0, 100)}`)
      }
    } catch (err) {
      results.failed++
      results.errors.push(`${uid}: ${err.message}`)
    }
    // Rate-limit safety: 350ms giua moi kick (Discord 5 req/2s an toan)
    if (i < targetIds.length - 1) await new Promise(r => setTimeout(r, 350))
  }

  res.json({ success: results.kicked > 0, ...results })
})

// POST: gui test thong bao - render giong that nhung KHONG ping ai
// Body: { channel_id, message, sample_size? (default 3) }
// Lay vai member dau danh sach lam vi du, allowed_mentions=[] de Discord khong ping
router.post('/silent-members/notify-test', async (req, res) => {
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chưa được cấu hình' })
  const { channel_id, message, sample_size } = req.body || {}
  if (!channel_id || !String(channel_id).trim()) return res.status(400).json({ error: 'Thiếu channel_id' })
  const rawMsg = (message == null ? '' : String(message)).trim()
  if (!rawMsg) return res.status(400).json({ error: 'Thiếu nội dung tin nhắn' })

  const guildId = GUILD_ID()
  const sampleN = Math.min(Math.max(Number(sample_size) || 3, 1), 10)
  const members = db.getSilentMembers(guildId, sampleN)
  const totalActual = db.countSilentMembers(guildId)
  const mentionsText = members.length
    ? members.map(m => `<@${m.user_id}>`).join(' ') + (totalActual > members.length ? ` ... (+${totalActual - members.length} member khác)` : '')
    : '(không có member nào trong danh sách)'

  const hasPlaceholder = rawMsg.includes('{mentions}')
  const baseTemplate = hasPlaceholder ? rawMsg : rawMsg + '\n{mentions}'
  const content = `**[TEST — không ping ai]**\n` + baseTemplate.replace('{mentions}', mentionsText)

  const url = `https://discord.com/api/v10/channels/${String(channel_id).trim()}/messages`
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${process.env.BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 1990), allowed_mentions: { parse: [] } }),
    })
    if (!r.ok) {
      const txt = await r.text()
      return res.status(r.status).json({ error: `Discord API ${r.status}: ${txt.slice(0, 300)}` })
    }
    res.json({ success: true, sample_count: members.length, total_actual: totalActual })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST: gui thong bao tag toan bo silent members vao channel chi dinh
// Body: { channel_id, message }
// message co the chua placeholder {mentions} - neu khong se append vao cuoi
// Tu dong chia batch de khong vuot 2000 ky tu/message cua Discord
// Filter role tu silent_filter_config da duoc ap khi scan → list trong DB da chinh xac
router.post('/silent-members/notify', async (req, res) => {
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chưa được cấu hình' })
  const { channel_id, message } = req.body || {}
  if (!channel_id || !String(channel_id).trim()) {
    return res.status(400).json({ error: 'Thiếu channel_id' })
  }
  const rawMsg = (message == null ? '' : String(message)).trim()
  if (!rawMsg) return res.status(400).json({ error: 'Thiếu nội dung tin nhắn' })

  const guildId = GUILD_ID()
  // Luu lai config cho lan sau
  db.setSilentNotifyConfig(guildId, { channelId: String(channel_id).trim(), message: rawMsg })
  const members = db.getSilentMembers(guildId, 1000)
  if (!members.length) return res.status(400).json({ error: 'Không có member nào trong danh sách silent (hãy quét trước)' })

  const targetChannel = String(channel_id).trim()
  const hasPlaceholder = rawMsg.includes('{mentions}')
  const baseTemplate = hasPlaceholder ? rawMsg : rawMsg + '\n{mentions}'

  // Chia batch theo gioi han 2000 ky tu cua Discord
  const DISCORD_LIMIT = 1900 // chua 100 ky tu margin cho header batch info
  const allMentions = members.map(m => `<@${m.user_id}>`)
  const fixedPart = baseTemplate.replace('{mentions}', '')
  const fixedLen = fixedPart.length

  const batches = []
  let current = []
  let currentLen = fixedLen
  for (const tag of allMentions) {
    const add = (current.length ? 1 : 0) + tag.length
    if (currentLen + add > DISCORD_LIMIT && current.length > 0) {
      batches.push(current)
      current = [tag]
      currentLen = fixedLen + tag.length
    } else {
      current.push(tag)
      currentLen += add
    }
  }
  if (current.length) batches.push(current)

  const url = `https://discord.com/api/v10/channels/${targetChannel}/messages`
  const results = { sent: 0, failed: 0, total_members: allMentions.length, batches: batches.length, errors: [] }

  for (let i = 0; i < batches.length; i++) {
    const mentionsText = batches[i].join(' ')
    const content = baseTemplate.replace('{mentions}', mentionsText)
    const payload = {
      content,
      allowed_mentions: { parse: ['users'] },
    }
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${process.env.BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        results.failed++
        const txt = await r.text()
        results.errors.push(`Batch ${i + 1}: Discord API ${r.status}: ${txt.slice(0, 200)}`)
        // Neu 401/403/404 ve channel thi dung som
        if (r.status === 401 || r.status === 403 || r.status === 404) break
      } else {
        results.sent++
      }
    } catch (err) {
      results.failed++
      results.errors.push(`Batch ${i + 1}: ${err.message}`)
    }
    // Rate-limit safety: 1.2s giua cac batch
    if (i < batches.length - 1) await new Promise(r => setTimeout(r, 1200))
  }

  if (results.failed > 0 && results.sent === 0) {
    return res.status(500).json({ error: 'Gửi thất bại', ...results })
  }
  res.json({ success: true, ...results })
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
