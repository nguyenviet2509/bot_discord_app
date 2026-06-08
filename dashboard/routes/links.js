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

// DELETE /api/links  body: { ids: [..] }  - xóa hàng loạt link
router.delete('/', (req, res) => {
  const guildId = GUILD_ID()
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((v) => parseInt(v)).filter(Boolean) : []
  if (ids.length === 0) return res.status(400).json({ error: 'Danh sách id không hợp lệ' })
  const result = db.deleteLinks(ids, guildId)
  res.json({ success: true, deleted: result.changes })
})

// POST /api/links/cleanup-old  body: { days: 30 }
// Xóa nhanh tất cả link cũ hơn N ngày (mặc định 30). Trả về số dòng đã xóa.
router.post('/cleanup-old', (req, res) => {
  const guildId = GUILD_ID()
  const days = parseInt(req.body?.days)
  if (!Number.isFinite(days) || days <= 0) {
    return res.status(400).json({ error: 'Số ngày không hợp lệ (phải > 0)' })
  }
  const result = db.deleteLinksOlderThan(days, guildId)
  res.json({ success: true, deleted: result.changes || 0, days })
})

// GET /api/links/cleanup-old/preview?days=30 - đếm số link sẽ bị xóa
router.get('/cleanup-old/preview', (req, res) => {
  const guildId = GUILD_ID()
  const days = parseInt(req.query.days)
  if (!Number.isFinite(days) || days <= 0) {
    return res.status(400).json({ error: 'Số ngày không hợp lệ (phải > 0)' })
  }
  const count = db.countLinksOlderThan(days, guildId)
  res.json({ count, days })
})

// DELETE /api/links/:id
router.delete('/:id', (req, res) => {
  const guildId = GUILD_ID()
  const result = db.deleteLink(req.params.id, guildId)
  if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy link' })
  res.json({ success: true })
})

module.exports = router
