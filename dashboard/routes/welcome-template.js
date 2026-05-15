const express = require('express')
const db = require('../../shared/db')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

router.get('/', (req, res) => {
  const tpl = db.getWelcomeTemplate(GUILD_ID())
  res.json({ ...tpl, enabled: !!tpl.enabled })
})

router.put('/', (req, res) => {
  const { enabled, message } = req.body
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Nội dung tin nhắn là bắt buộc' })
  }
  if (message.length > 1800) {
    return res.status(400).json({ error: 'Tin nhắn không được vượt quá 1800 ký tự' })
  }
  db.upsertWelcomeTemplate({
    guild_id: GUILD_ID(),
    enabled: enabled ? 1 : 0,
    message: message.trim(),
  })
  res.json({ success: true })
})

// Gui test toi channel level_up_reply (hoac channel_id truyen vao)
router.post('/test', async (req, res) => {
  const { channel_id, message } = req.body
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chưa được cấu hình' })

  const settings = db.getSettings(GUILD_ID())
  const targetChannel = channel_id || settings?.level_up_reply_channel_id
  if (!targetChannel) {
    return res.status(400).json({ error: 'Chưa cấu hình "Channel auto-reply khi lên cấp" trong tab Cấu hình' })
  }

  const tpl = message || db.getWelcomeTemplate(GUILD_ID()).message
  // Test khong co user thuc → dung placeholder
  const content = `**[TEST]** ` + tpl.replace(/\{user\}/g, '<@!000000000000000000>').replace(/\{username\}/g, 'TestUser')

  try {
    const r = await fetch(`https://discord.com/api/v10/channels/${targetChannel}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${process.env.BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      // allowed_mentions: tat mention test de khong tag nham
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    })
    if (!r.ok) {
      const errText = await r.text()
      return res.status(r.status).json({ error: `Discord API ${r.status}: ${errText.slice(0, 300)}` })
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
