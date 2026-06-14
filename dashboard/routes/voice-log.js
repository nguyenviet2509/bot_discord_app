const express = require('express')
const db = require('../../shared/db')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

router.get('/', (req, res) => {
  const cfg = db.getVoiceLogSettings(GUILD_ID())
  res.json({ ...cfg, enabled: !!cfg.enabled })
})

const HEX = /^#[0-9a-fA-F]{6}$/

router.put('/', (req, res) => {
  const {
    enabled, notify_channel_id, watched_channels,
    join_template, leave_template,
    use_embed, embed_color_join, embed_color_leave, show_author, show_footer,
  } = req.body || {}

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
  if (embed_color_join && !HEX.test(embed_color_join)) {
    return res.status(400).json({ error: 'Màu embed JOIN phải dạng #RRGGBB' })
  }
  if (embed_color_leave && !HEX.test(embed_color_leave)) {
    return res.status(400).json({ error: 'Màu embed LEAVE phải dạng #RRGGBB' })
  }

  db.upsertVoiceLogSettings({
    guild_id: GUILD_ID(),
    enabled: enabled ? 1 : 0,
    notify_channel_id: notify_channel_id || null,
    watched_channels: (watched_channels || []).map(String),
    join_template: String(join_template).trim(),
    leave_template: String(leave_template).trim(),
    use_embed: use_embed ? 1 : 0,
    embed_color_join: embed_color_join || null,
    embed_color_leave: embed_color_leave || null,
    show_author: show_author == null ? 1 : (show_author ? 1 : 0),
    show_footer: show_footer == null ? 1 : (show_footer ? 1 : 0),
  })

  res.json({ success: true })
})

module.exports = router
