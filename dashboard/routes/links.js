const express = require('express')
const db = require('../../shared/db')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

// GET /api/links?search=&channel_id=&page=1&limit=50
router.get('/', (req, res) => {
  const guildId = GUILD_ID()
  const { search = '', channel_id = '', page = 1, limit = 50 } = req.query
  const parsedLimit = Math.min(parseInt(limit) || 50, 200)
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * parsedLimit

  const rows = db.getLinks(guildId, { search, channel_id, limit: parsedLimit, offset })
  const total = db.countLinks(guildId, { search, channel_id })
  const channels = db.getChannelsWithLinks(guildId)

  res.json({ links: rows, total, channels, page: parseInt(page) || 1, limit: parsedLimit })
})

// DELETE /api/links/:id
router.delete('/:id', (req, res) => {
  const guildId = GUILD_ID()
  const result = db.deleteLink(req.params.id, guildId)
  if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy link' })
  res.json({ success: true })
})

module.exports = router
