const express = require('express')
const db = require('../../shared/db')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

// List all moderation actions (filterable)
router.get('/', (req, res) => {
  const { action_type, search, page = '1', limit = '50' } = req.query
  const limitNum = Math.min(Number(limit) || 50, 200)
  const pageNum = Math.max(Number(page) || 1, 1)
  const offset = (pageNum - 1) * limitNum

  const guildId = GUILD_ID()
  const actions = db.getModActions(guildId, { action_type, search, limit: limitNum, offset })
  const total = db.countModActions(guildId, { action_type, search })
  const activeBans = db.getActiveBans(guildId)
  res.json({ actions, total, page: pageNum, limit: limitNum, active_bans: activeBans })
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

module.exports = router
