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
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${token}`, 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    })

    if (!response.ok) {
      return res.status(502).json({ error: 'Không thể lấy danh sách roles từ Discord' })
    }

    const roles = await response.json()
    const filtered = roles
      .filter(r => r.name !== '@everyone' && !r.managed)
      .map(r => ({ id: r.id, name: r.name, color: r.color }))
      .sort((a, b) => a.name.localeCompare(b.name))

    res.json(filtered)
  } catch (err) {
    console.error('[discord-roles]', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

module.exports = router
