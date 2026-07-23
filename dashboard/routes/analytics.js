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

// GET /analytics/inactive
// ?with_filter=1 → tra ve { total, days, members } va ap role filter tu config
// Mac dinh → tra ve array (backward compat)
router.get('/inactive', async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 365)
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500)
  const guildId = GUILD_ID()
  const withFilter = req.query.with_filter === '1' || req.query.with_filter === 'true'
  if (!withFilter) {
    return res.json(db.getInactiveMembers(guildId, days, limit))
  }
  try {
    const members = await getFilteredInactive(guildId, days, limit)
    res.json({ days, total: members.length, members })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
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

// GET: so user da co trong reaction_users table
router.get('/reactions/status', (req, res) => {
  res.json({ tracked_users: db.countReactionUsers(GUILD_ID()) })
})

// POST: backfill reactions tu lich su channel
// Body: { days: 7-30 } — chi quet message trong window N ngay gan nhat
// Logic: list all text channel → moi channel fetch 100 msg gan nhat
// → voi msg co reactions trong window → fetch user list cho moi emoji
// → upsert vao reaction_users.
// Sau khi xong: auto re-scan silent members de UI dong bo.
// Discord rate limit: delay 250ms giua moi request.
router.post('/reactions/backfill', async (req, res) => {
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chưa được cấu hình' })
  const days = Math.min(Math.max(Number(req.body?.days) || 7, 7), 30)
  const guildId = GUILD_ID()
  const sinceMs = Date.now() - days * 86400 * 1000
  const token = process.env.BOT_TOKEN
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))

  const stats = { days, scanned_channels: 0, scanned_messages: 0, messages_with_reactions: 0, api_calls: 0, new_users: 0, errors: [] }

  try {
    const chRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { 'Authorization': `Bot ${token}` },
    })
    stats.api_calls++
    if (!chRes.ok) {
      const txt = await chRes.text()
      return res.status(500).json({ error: `Discord API ${chRes.status}: ${txt.slice(0, 200)}` })
    }
    const allChannels = await chRes.json()
    // Type 0 = text, 5 = announcement
    const textChannels = allChannels.filter(c => c.type === 0 || c.type === 5)

    const allUsers = new Set()
    for (const ch of textChannels) {
      try {
        const msgRes = await fetch(`https://discord.com/api/v10/channels/${ch.id}/messages?limit=100`, {
          headers: { 'Authorization': `Bot ${token}` },
        })
        stats.api_calls++
        if (!msgRes.ok) {
          // 403/404 = khong co perm hoac channel bi xoa → skip im lang
          if (msgRes.status !== 403 && msgRes.status !== 404) {
            stats.errors.push(`#${ch.name}: ${msgRes.status}`)
          }
          await sleep(250)
          continue
        }
        const messages = await msgRes.json()
        stats.scanned_channels++
        stats.scanned_messages += messages.length

        for (const msg of messages) {
          const ts = new Date(msg.timestamp).getTime()
          if (ts < sinceMs) continue
          if (!msg.reactions?.length) continue
          stats.messages_with_reactions++

          for (const reaction of msg.reactions) {
            await sleep(250)
            const emoji = reaction.emoji.id
              ? `${reaction.emoji.name}:${reaction.emoji.id}`
              : encodeURIComponent(reaction.emoji.name)
            try {
              const userRes = await fetch(`https://discord.com/api/v10/channels/${ch.id}/messages/${msg.id}/reactions/${emoji}?limit=100`, {
                headers: { 'Authorization': `Bot ${token}` },
              })
              stats.api_calls++
              if (!userRes.ok) {
                if (stats.errors.length < 10) stats.errors.push(`React ${msg.id}: ${userRes.status}`)
                continue
              }
              const users = await userRes.json()
              for (const u of users) if (!u.bot) allUsers.add(u.id)
            } catch (err) {
              if (stats.errors.length < 10) stats.errors.push(`React ${msg.id}: ${err.message}`)
            }
          }
        }
      } catch (err) {
        if (stats.errors.length < 10) stats.errors.push(`#${ch.name}: ${err.message}`)
      }
      await sleep(250)
    }

    // Filter: chi giu user la silent candidate (chua chat + pass role filter)
    const chattedIds = new Set(db.getAllUsers(guildId).map(u => u.id))
    const { include_role_id, exclude_role_id } = db.getSilentFilterConfig(guildId)

    let memberRoleMap = null
    if (include_role_id || exclude_role_id) {
      memberRoleMap = new Map() // user_id → roles[]
      let after = '0'
      for (let i = 0; i < 10; i++) {
        const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`, {
          headers: { 'Authorization': `Bot ${token}` },
        })
        stats.api_calls++
        if (!r.ok) break
        const batch = await r.json()
        if (!batch.length) break
        for (const m of batch) {
          if (m.user && !m.user.bot) memberRoleMap.set(m.user.id, m.roles || [])
        }
        after = batch[batch.length - 1].user.id
        if (batch.length < 1000) break
      }
    }

    const eligibleUsers = Array.from(allUsers).filter(uid => {
      if (chattedIds.has(uid)) return false
      if (memberRoleMap) {
        const roles = memberRoleMap.get(uid) || []
        if (include_role_id && !roles.includes(include_role_id)) return false
        if (exclude_role_id && roles.includes(exclude_role_id)) return false
      }
      return true
    })
    stats.collected_users = allUsers.size
    stats.eligible_users = eligibleUsers.length
    stats.new_users = db.markUsersReactedBulk(guildId, eligibleUsers)
    stats.total_reacted_users = db.countReactionUsers(guildId)

    // Auto re-scan silent members de UI dong bo
    try {
      const scanRes = await scanSilentMembers(guildId)
      stats.silent_after_rescan = scanRes.total
    } catch (err) {
      if (stats.errors.length < 10) stats.errors.push(`Rescan: ${err.message}`)
    }

    res.json({ success: true, ...stats, errors: stats.errors.slice(0, 5) })
  } catch (err) {
    res.status(500).json({ error: err.message, ...stats })
  }
})

// Get/Set notify template (channel + noi dung) — persist tren DB
router.get('/silent-notify-config', (req, res) => {
  res.json(db.getSilentNotifyConfig(GUILD_ID()))
})

router.put('/silent-notify-config', (req, res) => {
  const { channel_id, message, link_url, link_label } = req.body || {}
  let normalizedLink = null
  if (link_url && String(link_url).trim()) {
    const parsed = parseDiscordMessageLink(link_url)
    if (!parsed) return res.status(400).json({ error: 'Link tin nhắn không hợp lệ' })
    normalizedLink = parsed.url
  }
  db.setSilentNotifyConfig(GUILD_ID(), {
    channelId: channel_id ? String(channel_id).trim() : null,
    message: message != null ? String(message) : null,
    linkUrl: normalizedLink,
    linkLabel: link_label != null ? String(link_label).slice(0, 200) : null,
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

// Helper: build embed object cho silent-member notify (style dong nhat)
// Discord embed limit: title 256, description 4096
function buildSilentNotifyEmbed({ description, footerText, isTest = false }) {
  return {
    color: isTest ? 0xF59E0B : 0x6366F1, // amber test / indigo real
    title: isTest ? '🧪 [TEST] Thông báo cho member chưa chat' : '📢 Thông báo dành cho bạn',
    description: description.slice(0, 4096),
    footer: footerText ? { text: footerText.slice(0, 2048) } : undefined,
    timestamp: new Date().toISOString(),
  }
}

// Parse Discord message link → tra ve { url, guildId, channelId, messageId } hoac null neu invalid
// Ho tro nhieu format:
// - URL day du: https://discord.com/channels/{guild}/{channel}/{message}
// - "{channel_id}/{message_id}" (dung GUILD_ID hien tai)
// - "{channel_id} {message_id}" (cach nhau bang space/dau phay)
function parseDiscordMessageLink(input) {
  if (!input) return null
  const str = String(input).trim()

  // Format 1: URL day du
  const urlMatch = str.match(/discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/)
  if (urlMatch) {
    return { url: `https://discord.com/channels/${urlMatch[1]}/${urlMatch[2]}/${urlMatch[3]}`, guildId: urlMatch[1], channelId: urlMatch[2], messageId: urlMatch[3] }
  }

  // Format 2 & 3: 2 ID (channel + message), dung GUILD_ID hien tai
  const ids = str.match(/\d{17,20}/g)
  if (ids && ids.length >= 2) {
    const guildId = process.env.GUILD_ID
    if (!guildId) return null
    return { url: `https://discord.com/channels/${guildId}/${ids[0]}/${ids[1]}`, guildId, channelId: ids[0], messageId: ids[1] }
  }

  return null
}

// POST: gui test thong bao - render giong that nhung KHONG ping ai
// Body: { channel_id, message, sample_size? (default 3) }
// Lay vai member dau danh sach lam vi du, allowed_mentions=[] de Discord khong ping
router.post('/silent-members/notify-test', async (req, res) => {
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chưa được cấu hình' })
  const { channel_id, message, sample_size, mention_style, link_url, link_label } = req.body || {}
  if (!channel_id || !String(channel_id).trim()) return res.status(400).json({ error: 'Thiếu channel_id' })
  const rawMsg = (message == null ? '' : String(message)).trim()
  if (!rawMsg) return res.status(400).json({ error: 'Thiếu nội dung tin nhắn' })

  const style = ['spoiler', 'subtext', 'plain'].includes(mention_style) ? mention_style : 'spoiler'
  const parsedLink = link_url ? parseDiscordMessageLink(link_url) : null
  const guildId = GUILD_ID()
  const sampleN = Math.min(Math.max(Number(sample_size) || 3, 1), 10)
  const members = db.getSilentMembers(guildId, sampleN)
  const totalActual = db.countSilentMembers(guildId)

  // Preview mentions theo style chon (van khong ping vi allowed_mentions=[])
  const sampleTags = members.map(m => `<@${m.user_id}>`)
  const extraNote = totalActual > members.length ? ` ... (+${totalActual - members.length} member khác)` : ''
  let mentionsText
  if (!sampleTags.length) {
    mentionsText = '(không có member nào trong danh sách)'
  } else if (style === 'spoiler') {
    mentionsText = `||${sampleTags.join(' ')}||${extraNote}`
  } else if (style === 'subtext') {
    mentionsText = `-# ${sampleTags.join(' ')}${extraNote}`
  } else {
    mentionsText = sampleTags.join(' ') + extraNote
  }

  const hasPlaceholder = rawMsg.includes('{mentions}')
  let description = hasPlaceholder
    ? rawMsg.replace('{mentions}', '').replace(/\n{3,}/g, '\n\n').trim() + `\n\n**Preview mentions (${style}):**\n${mentionsText}`
    : `${rawMsg}\n\n**Preview mentions (${style}):**\n${mentionsText}`
  if (parsedLink) {
    const label = (link_label != null && String(link_label).trim())
      ? String(link_label).trim().slice(0, 200)
      : '🔗 Click để xem tin nhắn liên quan →'
    description += `\n\n[${label}](${parsedLink.url})`
  }

  const embed = buildSilentNotifyEmbed({
    description,
    footerText: `Test • Sample ${members.length}/${totalActual} member • Style: ${style} • Không ping`,
    isTest: true,
  })

  const url = `https://discord.com/api/v10/channels/${String(channel_id).trim()}/messages`
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${process.env.BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
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
  const { channel_id, message, mention_style, link_url, link_label } = req.body || {}
  if (!channel_id || !String(channel_id).trim()) {
    return res.status(400).json({ error: 'Thiếu channel_id' })
  }
  const rawMsg = (message == null ? '' : String(message)).trim()
  if (!rawMsg) return res.status(400).json({ error: 'Thiếu nội dung tin nhắn' })

  // Style: 'spoiler' (1 thanh den, click de xem), 'subtext' (text xam nho), 'plain' (mac dinh)
  const style = ['spoiler', 'subtext', 'plain'].includes(mention_style) ? mention_style : 'spoiler'

  // Parse link tin nhan dinh kem (neu co)
  let parsedLink = null
  if (link_url && String(link_url).trim()) {
    parsedLink = parseDiscordMessageLink(link_url)
    if (!parsedLink) return res.status(400).json({ error: 'Link tin nhắn không hợp lệ' })
  }
  const linkLabel = (link_label != null && String(link_label).trim())
    ? String(link_label).trim().slice(0, 200)
    : '🔗 Click để xem tin nhắn liên quan →'

  const guildId = GUILD_ID()
  db.setSilentNotifyConfig(guildId, {
    channelId: String(channel_id).trim(),
    message: rawMsg,
    linkUrl: parsedLink ? parsedLink.url : null,
    linkLabel: link_label != null ? String(link_label).slice(0, 200) : null,
  })
  const members = db.getSilentMembers(guildId, 1000)
  if (!members.length) return res.status(400).json({ error: 'Không có member nào trong danh sách silent (hãy quét trước)' })

  const targetChannel = String(channel_id).trim()
  // Mentions phai nam trong CONTENT de Discord ping (embed mentions khong ping).
  // Chia batch theo gioi han content 2000 ky tu (tinh ca overhead spoiler/subtext).
  const DISCORD_CONTENT_LIMIT = 1900
  // Overhead per batch: 'spoiler' wrap '||...||' = 4 ky tu, 'subtext' prefix '-# ' = 3 ky tu
  const OVERHEAD = style === 'spoiler' ? 4 : (style === 'subtext' ? 3 : 0)
  const allMentions = members.map(m => `<@${m.user_id}>`)
  const batches = []
  let current = []
  let currentLen = OVERHEAD
  for (const tag of allMentions) {
    const add = (current.length ? 1 : 0) + tag.length
    if (currentLen + add > DISCORD_CONTENT_LIMIT && current.length > 0) {
      batches.push(current)
      current = [tag]
      currentLen = OVERHEAD + tag.length
    } else {
      current.push(tag)
      currentLen += add
    }
  }
  if (current.length) batches.push(current)

  // Wrap mentions theo style chon
  const wrapMentions = (tags) => {
    const joined = tags.join(' ')
    if (style === 'spoiler') return `||${joined}||`
    if (style === 'subtext') return `-# ${joined}`
    return joined
  }

  const url = `https://discord.com/api/v10/channels/${targetChannel}/messages`
  const results = { sent: 0, failed: 0, total_members: allMentions.length, batches: batches.length, errors: [] }

  for (let i = 0; i < batches.length; i++) {
    const mentionsText = wrapMentions(batches[i])
    // Embed description: clone message, xoa placeholder {mentions} (mentions tach ra content)
    let description = rawMsg.replace('{mentions}', '').replace(/\n{3,}/g, '\n\n').trim()
    // Append link tin nhan dinh kem neu co (text Markdown link)
    if (parsedLink) {
      description += `\n\n[${linkLabel}](${parsedLink.url})`
    }
    const footerParts = [`${batches[i].length} member trong batch này`]
    if (batches.length > 1) footerParts.push(`Batch ${i + 1}/${batches.length}`)
    const embed = buildSilentNotifyEmbed({
      description: description || ' ',
      footerText: footerParts.join(' • '),
    })
    const payload = {
      content: mentionsText,
      embeds: [embed],
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
    const { include_role_id, exclude_role_id, apply_reaction_filter } = req.body || {}
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

    db.setSilentFilterConfig(GUILD_ID(), {
      includeRoleId: normInclude,
      excludeRoleId: normExclude,
      applyReactionFilter: apply_reaction_filter,
    })
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

// ============================================================
// Inactive members: role filter + notify + kick (mirror silent)
// ============================================================

// Cache map user_id -> roles[] tu Discord API (60s TTL)
// Giu ngoai closure de share giua cac request; tranh spam Discord
let inactiveMembersRolesCache = { at: 0, map: null }
async function getGuildMemberRolesMap(guildId) {
  if (Date.now() - inactiveMembersRolesCache.at < 60_000 && inactiveMembersRolesCache.map) {
    return inactiveMembersRolesCache.map
  }
  if (!process.env.BOT_TOKEN) throw new Error('BOT_TOKEN chưa được cấu hình')
  const map = new Map()
  let after = '0'
  for (let i = 0; i < 10; i++) {
    const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`, {
      headers: { 'Authorization': `Bot ${process.env.BOT_TOKEN}` },
    })
    if (!r.ok) throw new Error(`Discord API ${r.status}: ${(await r.text()).slice(0, 200)}`)
    const batch = await r.json()
    if (!batch.length) break
    for (const m of batch) {
      if (m.user && !m.user.bot) {
        map.set(m.user.id, { roles: m.roles || [], nickname: m.nick || null, joined_at: m.joined_at || null })
      }
    }
    after = batch[batch.length - 1].user.id
    if (batch.length < 1000) break
  }
  inactiveMembersRolesCache = { at: Date.now(), map }
  return map
}

// Lay list inactive tu DB roi ap role filter va loai user da roi server
// LUON fetch Discord member list de loai bo user da roi server (bot co the miss leave event).
// Fetch DB voi hard cap cao (10k) de dam bao du data sau khi filter role.
async function getFilteredInactive(guildId, days, limit) {
  const rows = db.getInactiveMembers(guildId, days, 10000)
  const { include_role_id, exclude_role_id } = db.getInactiveFilterConfig(guildId)

  // Fetch Discord member roles map. Neu fail va co role filter → tra ve rong (an toan).
  // Neu fail va khong co role filter → fallback dung DB thuan.
  let rolesMap = null
  try {
    rolesMap = await getGuildMemberRolesMap(guildId)
  } catch (err) {
    if (include_role_id || exclude_role_id) throw err
    rolesMap = null
  }

  const filtered = []
  for (const u of rows) {
    if (rolesMap) {
      if (!rolesMap.has(u.id)) continue // da roi server
      const roles = rolesMap.get(u.id).roles || []
      if (include_role_id && !roles.includes(include_role_id)) continue
      if (exclude_role_id && roles.includes(exclude_role_id)) continue
    }
    filtered.push(u)
    if (filtered.length >= limit) break
  }
  return filtered
}

// GET/PUT filter config
router.get('/inactive-filter-config', (req, res) => {
  res.json(db.getInactiveFilterConfig(GUILD_ID()))
})

router.put('/inactive-filter-config', async (req, res) => {
  try {
    const { include_role_id, exclude_role_id } = req.body || {}
    db.setInactiveFilterConfig(GUILD_ID(), {
      includeRoleId: include_role_id ? String(include_role_id) : null,
      excludeRoleId: exclude_role_id ? String(exclude_role_id) : null,
    })
    // Invalidate cache de user thay ngay ket qua
    inactiveMembersRolesCache = { at: 0, map: null }
    res.json({ success: true, config: db.getInactiveFilterConfig(GUILD_ID()) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET/PUT notify template
router.get('/inactive-notify-config', (req, res) => {
  res.json(db.getInactiveNotifyConfig(GUILD_ID()))
})

router.put('/inactive-notify-config', (req, res) => {
  const { channel_id, message, link_url, link_label } = req.body || {}
  let normalizedLink = null
  if (link_url && String(link_url).trim()) {
    const parsed = parseDiscordMessageLink(link_url)
    if (!parsed) return res.status(400).json({ error: 'Link tin nhắn không hợp lệ' })
    normalizedLink = parsed.url
  }
  db.setInactiveNotifyConfig(GUILD_ID(), {
    channelId: channel_id ? String(channel_id).trim() : null,
    message: message != null ? String(message) : null,
    linkUrl: normalizedLink,
    linkLabel: link_label != null ? String(link_label).slice(0, 200) : null,
  })
  res.json({ success: true, config: db.getInactiveNotifyConfig(GUILD_ID()) })
})

// Helper: build embed cho inactive notify (dung style rieng, mau amber-ish khac silent)
function buildInactiveNotifyEmbed({ description, footerText, isTest = false }) {
  return {
    color: isTest ? 0xF59E0B : 0xF97316, // amber test / orange real
    title: isTest ? '🧪 [TEST] Thông báo cho member inactive' : '📢 Đã lâu bạn chưa quay lại',
    description: description.slice(0, 4096),
    footer: footerText ? { text: footerText.slice(0, 2048) } : undefined,
    timestamp: new Date().toISOString(),
  }
}

// POST kick inactive members
// Body: { user_ids: string[] | 'all', days }
// Safety: chi kick nhung user hien co trong filtered list voi cung days
router.post('/inactive/kick', async (req, res) => {
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chưa được cấu hình' })
  const guildId = GUILD_ID()
  const { user_ids } = req.body || {}
  const days = Math.min(Math.max(Number(req.body?.days) || 7, 1), 365)

  let filtered
  try {
    filtered = await getFilteredInactive(guildId, days, 500)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
  const allowedIds = new Set(filtered.map(m => m.id))

  let targetIds
  if (user_ids === 'all') {
    targetIds = filtered.map(m => m.id)
  } else if (Array.isArray(user_ids) && user_ids.length > 0) {
    targetIds = user_ids.map(String).filter(id => allowedIds.has(id))
  } else {
    return res.status(400).json({ error: 'Thiếu user_ids hoặc rỗng' })
  }
  if (targetIds.length === 0) {
    return res.status(400).json({ error: 'Không có member hợp lệ để kick (phải nằm trong list inactive đã filter)' })
  }

  const results = { kicked: 0, failed: 0, total: targetIds.length, errors: [] }
  for (let i = 0; i < targetIds.length; i++) {
    const uid = targetIds[i]
    try {
      const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${uid}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bot ${process.env.BOT_TOKEN}`,
          'X-Audit-Log-Reason': 'Inactive member - dashboard kick',
        },
      })
      if (r.ok || r.status === 204) {
        results.kicked++
      } else {
        const txt = await r.text()
        results.failed++
        results.errors.push(`${uid}: ${r.status} ${txt.slice(0, 100)}`)
      }
    } catch (err) {
      results.failed++
      results.errors.push(`${uid}: ${err.message}`)
    }
    if (i < targetIds.length - 1) await new Promise(r => setTimeout(r, 350))
  }
  // Invalidate cache de member da bi kick khong con trong list
  inactiveMembersRolesCache = { at: 0, map: null }
  res.json({ success: results.kicked > 0, ...results })
})

// POST notify-test cho inactive: gui embed KHONG ping ai (allowed_mentions=[])
router.post('/inactive/notify-test', async (req, res) => {
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chưa được cấu hình' })
  const { channel_id, message, sample_size, mention_style, link_url, link_label } = req.body || {}
  const days = Math.min(Math.max(Number(req.body?.days) || 7, 1), 365)
  if (!channel_id || !String(channel_id).trim()) return res.status(400).json({ error: 'Thiếu channel_id' })
  const rawMsg = (message == null ? '' : String(message)).trim()
  if (!rawMsg) return res.status(400).json({ error: 'Thiếu nội dung tin nhắn' })

  const style = ['spoiler', 'subtext', 'plain'].includes(mention_style) ? mention_style : 'spoiler'
  const parsedLink = link_url ? parseDiscordMessageLink(link_url) : null
  const guildId = GUILD_ID()
  const sampleN = Math.min(Math.max(Number(sample_size) || 3, 1), 10)

  let filtered
  try {
    filtered = await getFilteredInactive(guildId, days, 500)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
  const members = filtered.slice(0, sampleN)
  const totalActual = filtered.length

  const sampleTags = members.map(m => `<@${m.id}>`)
  const extraNote = totalActual > members.length ? ` ... (+${totalActual - members.length} member khác)` : ''
  let mentionsText
  if (!sampleTags.length) {
    mentionsText = '(không có member nào trong danh sách)'
  } else if (style === 'spoiler') {
    mentionsText = `||${sampleTags.join(' ')}||${extraNote}`
  } else if (style === 'subtext') {
    mentionsText = `-# ${sampleTags.join(' ')}${extraNote}`
  } else {
    mentionsText = sampleTags.join(' ') + extraNote
  }

  const hasPlaceholder = rawMsg.includes('{mentions}')
  let description = hasPlaceholder
    ? rawMsg.replace('{mentions}', '').replace(/\n{3,}/g, '\n\n').trim() + `\n\n**Preview mentions (${style}):**\n${mentionsText}`
    : `${rawMsg}\n\n**Preview mentions (${style}):**\n${mentionsText}`
  if (parsedLink) {
    const label = (link_label != null && String(link_label).trim())
      ? String(link_label).trim().slice(0, 200)
      : '🔗 Click để xem tin nhắn liên quan →'
    description += `\n\n[${label}](${parsedLink.url})`
  }

  const embed = buildInactiveNotifyEmbed({
    description,
    footerText: `Test • Sample ${members.length}/${totalActual} member (inactive ${days}+ ngày) • Style: ${style} • Không ping`,
    isTest: true,
  })

  try {
    const r = await fetch(`https://discord.com/api/v10/channels/${String(channel_id).trim()}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${process.env.BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
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

// POST gui thong bao tag toan bo inactive members (chia batch < 2000 char)
router.post('/inactive/notify', async (req, res) => {
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chưa được cấu hình' })
  const { channel_id, message, mention_style, link_url, link_label } = req.body || {}
  const days = Math.min(Math.max(Number(req.body?.days) || 7, 1), 365)
  if (!channel_id || !String(channel_id).trim()) return res.status(400).json({ error: 'Thiếu channel_id' })
  const rawMsg = (message == null ? '' : String(message)).trim()
  if (!rawMsg) return res.status(400).json({ error: 'Thiếu nội dung tin nhắn' })

  const style = ['spoiler', 'subtext', 'plain'].includes(mention_style) ? mention_style : 'spoiler'

  let parsedLink = null
  if (link_url && String(link_url).trim()) {
    parsedLink = parseDiscordMessageLink(link_url)
    if (!parsedLink) return res.status(400).json({ error: 'Link tin nhắn không hợp lệ' })
  }
  const linkLabel = (link_label != null && String(link_label).trim())
    ? String(link_label).trim().slice(0, 200)
    : '🔗 Click để xem tin nhắn liên quan →'

  const guildId = GUILD_ID()
  // Persist config
  db.setInactiveNotifyConfig(guildId, {
    channelId: String(channel_id).trim(),
    message: rawMsg,
    linkUrl: parsedLink ? parsedLink.url : null,
    linkLabel: link_label != null ? String(link_label).slice(0, 200) : null,
  })

  let members
  try {
    members = await getFilteredInactive(guildId, days, 500)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
  if (!members.length) return res.status(400).json({ error: 'Không có member nào trong danh sách inactive (theo filter hiện tại)' })

  const targetChannel = String(channel_id).trim()
  const DISCORD_CONTENT_LIMIT = 1900
  const OVERHEAD = style === 'spoiler' ? 4 : (style === 'subtext' ? 3 : 0)
  const allMentions = members.map(m => `<@${m.id}>`)
  const batches = []
  let current = []
  let currentLen = OVERHEAD
  for (const tag of allMentions) {
    const add = (current.length ? 1 : 0) + tag.length
    if (currentLen + add > DISCORD_CONTENT_LIMIT && current.length > 0) {
      batches.push(current)
      current = [tag]
      currentLen = OVERHEAD + tag.length
    } else {
      current.push(tag)
      currentLen += add
    }
  }
  if (current.length) batches.push(current)

  const wrapMentions = (tags) => {
    const joined = tags.join(' ')
    if (style === 'spoiler') return `||${joined}||`
    if (style === 'subtext') return `-# ${joined}`
    return joined
  }

  const url = `https://discord.com/api/v10/channels/${targetChannel}/messages`
  const results = { sent: 0, failed: 0, total_members: allMentions.length, batches: batches.length, errors: [] }

  for (let i = 0; i < batches.length; i++) {
    const mentionsText = wrapMentions(batches[i])
    let description = rawMsg.replace('{mentions}', '').replace(/\n{3,}/g, '\n\n').trim()
    if (parsedLink) description += `\n\n[${linkLabel}](${parsedLink.url})`
    const footerParts = [`${batches[i].length} member (inactive ${days}+ ngày)`]
    if (batches.length > 1) footerParts.push(`Batch ${i + 1}/${batches.length}`)
    const embed = buildInactiveNotifyEmbed({
      description: description || ' ',
      footerText: footerParts.join(' • '),
    })
    const payload = {
      content: mentionsText,
      embeds: [embed],
      allowed_mentions: { parse: ['users'] },
    }
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${process.env.BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        results.failed++
        const txt = await r.text()
        results.errors.push(`Batch ${i + 1}: Discord API ${r.status}: ${txt.slice(0, 200)}`)
        if (r.status === 401 || r.status === 403 || r.status === 404) break
      } else {
        results.sent++
      }
    } catch (err) {
      results.failed++
      results.errors.push(`Batch ${i + 1}: ${err.message}`)
    }
    if (i < batches.length - 1) await new Promise(r => setTimeout(r, 1200))
  }

  if (results.failed > 0 && results.sent === 0) {
    return res.status(500).json({ error: 'Gửi thất bại', ...results })
  }
  res.json({ success: true, ...results })
})

module.exports = router
