const express = require('express')

const router = express.Router()

router.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const guildId = process.env.GUILD_ID
  const token = process.env.BOT_TOKEN

  if (!guildId || !token) {
    return res.status(500).json({ error: 'GUILD_ID hoặc BOT_TOKEN chưa được cấu hình' })
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${token}`, 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    })

    if (!response.ok) {
      return res.status(502).json({ error: 'Không thể lấy danh sách channels từ Discord' })
    }

    const channels = await response.json()
    // type 0 = GUILD_TEXT, 2 = GUILD_VOICE, 5 = GUILD_ANNOUNCEMENT
    const out = channels
      .filter(c => c.type === 0 || c.type === 2 || c.type === 5)
      .map(c => ({
        id: c.id,
        name: c.name,
        type: c.type === 2 ? 'voice' : 'text',
        parent_id: c.parent_id || null,
        position: c.position ?? 0,
      }))
      .sort((a, b) => a.position - b.position)

    res.json(out)
  } catch (err) {
    console.error('[discord-channels]', err.message)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

module.exports = router
