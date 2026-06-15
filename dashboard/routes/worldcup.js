const express = require('express')
const wc = require('../../shared/db-worldcup')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

const VALID_ROUNDS = ['group', 'r16', 'qf', 'sf', '3rd', 'final']
const VALID_STATUSES = ['scheduled', 'finished', 'cancelled']

// ============================================================
// Teams
router.get('/teams', (req, res) => {
  res.json(wc.listTeams())
})

router.post('/teams', (req, res) => {
  const { code, name } = req.body || {}
  if (!code || !name) return res.status(400).json({ error: 'code va name la bat buoc' })
  if (code.length > 8 || name.length > 50) return res.status(400).json({ error: 'code/name qua dai' })
  try {
    res.json(wc.createTeam({ code: String(code).toUpperCase(), name: String(name).trim() }))
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ma doi da ton tai' })
    res.status(500).json({ error: err.message })
  }
})

router.patch('/teams/:id', (req, res) => {
  const id = Number(req.params.id)
  const { code, name } = req.body || {}
  try {
    const updated = wc.updateTeam(id, { code: code ? String(code).toUpperCase() : null, name: name ? String(name).trim() : null })
    if (!updated) return res.status(404).json({ error: 'Khong tim thay doi' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/teams/:id', (req, res) => {
  const id = Number(req.params.id)
  try {
    wc.deleteTeam(id)
    res.json({ ok: true })
  } catch (err) {
    if (err.code === 'TEAM_IN_USE') return res.status(409).json({ error: err.message })
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// Matches
router.get('/matches', (req, res) => {
  const { round, status } = req.query
  res.json(wc.listMatches({ round: round || undefined, status: status || undefined }))
})

function validateMatchInput({ team1Id, team2Id, kickOffAt, round, groupName }) {
  if (!team1Id || !team2Id) return 'team1Id va team2Id la bat buoc'
  if (team1Id === team2Id) return 'Hai doi phai khac nhau'
  if (!kickOffAt || isNaN(Number(kickOffAt))) return 'kickOffAt phai la unix ms hop le'
  if (!VALID_ROUNDS.includes(round)) return `round phai thuoc: ${VALID_ROUNDS.join(', ')}`
  if (round === 'group' && (!groupName || !/^[A-H]$/.test(groupName))) return 'Vong bang yeu cau group_name la chu A-H'
  return null
}

router.post('/matches', (req, res) => {
  const body = req.body || {}
  const err = validateMatchInput(body)
  if (err) return res.status(400).json({ error: err })
  try {
    const created = wc.createMatch({
      team1Id: Number(body.team1Id),
      team2Id: Number(body.team2Id),
      kickOffAt: Number(body.kickOffAt),
      round: body.round,
      groupName: body.round === 'group' ? body.groupName.toUpperCase() : null,
    })
    res.json(created)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.patch('/matches/:id', (req, res) => {
  const id = Number(req.params.id)
  const body = req.body || {}
  const patch = {}
  if (body.team1Id != null) patch.team1Id = Number(body.team1Id)
  if (body.team2Id != null) patch.team2Id = Number(body.team2Id)
  if (body.kickOffAt != null) patch.kickOffAt = Number(body.kickOffAt)
  if (body.round != null) {
    if (!VALID_ROUNDS.includes(body.round)) return res.status(400).json({ error: `round invalid` })
    patch.round = body.round
  }
  if (body.groupName !== undefined) patch.groupName = body.groupName ? String(body.groupName).toUpperCase() : null
  if (body.status != null) {
    if (!VALID_STATUSES.includes(body.status)) return res.status(400).json({ error: 'status invalid' })
    patch.status = body.status
  }
  try {
    const updated = wc.updateMatch(id, patch)
    if (!updated) return res.status(404).json({ error: 'Khong tim thay tran dau' })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/matches/:id', (req, res) => {
  const id = Number(req.params.id)
  try {
    wc.deleteMatch(id)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ============================================================
// Guild config (per-guild, hien tai map sang GUILD_ID env)
router.get('/config', (req, res) => {
  res.json(wc.getGuildConfig(GUILD_ID()))
})

router.put('/config', (req, res) => {
  const { enabled, channel_id, notify_before_minutes, role_ping_id, timezone } = req.body || {}
  if (notify_before_minutes != null) {
    const n = Number(notify_before_minutes)
    if (isNaN(n) || n < 5 || n > 1440) return res.status(400).json({ error: 'notify_before_minutes phai 5-1440' })
  }
  try {
    const updated = wc.upsertGuildConfig(GUILD_ID(), {
      enabled: enabled != null ? !!enabled : undefined,
      channel_id: channel_id || null,
      notify_before_minutes: notify_before_minutes != null ? Number(notify_before_minutes) : undefined,
      role_ping_id: role_ping_id || null,
      timezone: timezone || undefined,
    })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Preview: build embed payload tu match upcoming gan nhat (de UI hien thi)
router.get('/preview', (req, res) => {
  const { buildMatchPayload } = require('../../bot/src/utils/worldcup-notifier')
  const config = wc.getGuildConfig(GUILD_ID())
  const matches = wc.findUpcomingMatches({ fromMs: Date.now(), toMs: Date.now() + 365 * 24 * 60 * 60_000 })
  if (matches.length === 0) {
    return res.json({ empty: true, message: 'Chua co tran dau nao sap dien ra' })
  }
  const next = matches.sort((a, b) => a.kick_off_at - b.kick_off_at)[0]
  const payload = buildMatchPayload(next, config)
  // EmbedBuilder.toJSON() de gui ve client
  res.json({
    empty: false,
    match: next,
    content: payload.content,
    embed: payload.embeds[0].toJSON(),
  })
})

// Test send: gui ngay 1 tin embed qua Discord REST API.
// - Neu co matchId trong body -> gui chinh tran do
// - Khong co -> gui tran upcoming gan nhat
router.post('/test-send', async (req, res) => {
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chua duoc cau hinh' })
  const { buildMatchPayload } = require('../../bot/src/utils/worldcup-notifier')
  const config = wc.getGuildConfig(GUILD_ID())
  if (!config.channel_id) return res.status(400).json({ error: 'Chua cau hinh channel' })

  let target
  const matchId = req.body && req.body.matchId
  if (matchId) {
    target = wc.getMatch(Number(matchId))
    if (!target) return res.status(404).json({ error: 'Khong tim thay tran dau' })
  } else {
    const matches = wc.findUpcomingMatches({ fromMs: Date.now() - 7 * 24 * 60 * 60_000, toMs: Date.now() + 365 * 24 * 60 * 60_000 })
    if (matches.length === 0) return res.status(400).json({ error: 'Chua co tran dau de preview' })
    target = matches.sort((a, b) => a.kick_off_at - b.kick_off_at)[0]
  }
  const payload = buildMatchPayload(target, config)
  const body = {
    content: `**[TEST]** ${payload.content || ''}`.trim(),
    embeds: [payload.embeds[0].toJSON()],
  }
  try {
    const r = await fetch(`https://discord.com/api/v10/channels/${config.channel_id}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${process.env.BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const t = await r.text()
      return res.status(r.status).json({ error: `Discord API ${r.status}: ${t.slice(0, 300)}` })
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ============================================================
// Wipe toan bo du lieu: xoa matches + log + config. Giu lai 48 doi seed.
// Yeu cau body { confirm: 'XOA' } de tranh nham.
router.post('/wipe-all', (req, res) => {
  const confirm = req.body && req.body.confirm
  if (confirm !== 'XOA') {
    return res.status(400).json({ error: 'Yeu cau xac nhan: truyen { confirm: "XOA" } trong body' })
  }
  try {
    const result = wc.wipeAllData()
    res.json({ ok: true, deleted: result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
