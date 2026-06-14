const express = require('express')
const db = require('../../shared/db')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

router.get('/', (req, res) => {
  const cfg = db.getVoiceLogSettings(GUILD_ID())
  res.json({ ...cfg, enabled: !!cfg.enabled })
})

router.put('/', (req, res) => {
  const { enabled, notify_channel_id, watched_channels, join_template, leave_template } = req.body || {}

  if (!join_template || !String(join_template).trim()) {
    return res.status(400).json({ error: 'Mẫu tin nhắn JOIN không được rỗng' })
  }
  if (!leave_template || !String(leave_template).trim()) {
    return res.status(400).json({ error: 'Mẫu tin nhắn LEAVE không được rỗng' })
  }
  if (String(join_template).length > 1500 || String(leave_template).length > 1500) {
    return res.status(400).json({ error: 'Mẫu tin nhắn tối đa 1500 ký tự' })
  }
  if (watched_channels != null && !Array.isArray(watched_channels)) {
    return res.status(400).json({ error: 'watched_channels phải là array' })
  }

  db.upsertVoiceLogSettings({
    guild_id: GUILD_ID(),
    enabled: enabled ? 1 : 0,
    notify_channel_id: notify_channel_id || null,
    watched_channels: (watched_channels || []).map(String),
    join_template: String(join_template).trim(),
    leave_template: String(leave_template).trim(),
  })

  res.json({ success: true })
})

module.exports = router
