// Dashboard routes cho lich su mini-game ROLL.
// Single-guild model: guild_id lay tu env.GUILD_ID (giong automod/honor).
// Audit log dung console JSON-line (Validation S1).

const express = require('express')
const store = require('../../bot/src/modules/mini-game/services/roll-session-store')

const router = express.Router()
const GUILD = () => process.env.GUILD_ID

function actorOf(req) {
  return req.user?.username || req.user?.id || 'unknown'
}

function audit(action, data) {
  console.log(JSON.stringify({
    tag: '[roll-history:audit]',
    ts: new Date().toISOString(),
    action,
    ...data,
  }))
}

// GET /api/roll-history?from=&to=&page=&pageSize=
router.get('/', (req, res) => {
  try {
    const page = Math.max(1, Number.isFinite(+req.query.page) ? +req.query.page : 1)
    const rawPageSize = Number.isFinite(+req.query.pageSize) ? +req.query.pageSize : 20
    const pageSize = Math.min(100, Math.max(1, rawPageSize))
    const offset = (page - 1) * pageSize
    const from = Number.isFinite(+req.query.from) && +req.query.from > 0 ? +req.query.from : null
    const to = Number.isFinite(+req.query.to) && +req.query.to > 0 ? +req.query.to : null

    const { rows, total } = store.listHistory({
      guildId: GUILD(),
      from, to, limit: pageSize, offset,
    })
    res.json({ data: rows, total, page, pageSize })
  } catch (err) {
    console.error('[roll-history:list]', err)
    res.status(500).json({ error: 'Internal' })
  }
})

// GET /api/roll-history/:id
router.get('/:id', (req, res) => {
  try {
    const id = +req.params.id
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id khong hop le' })
    const result = store.getHistoryDetail(id, GUILD())
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.json(result)
  } catch (err) {
    console.error('[roll-history:detail]', err)
    res.status(500).json({ error: 'Internal' })
  }
})

// DELETE /api/roll-history/all  (body: { confirm: 'NUKE' })
// Dat truoc /:id va olderThanDays handler de tranh route matching collision
router.delete('/all', (req, res) => {
  try {
    if (req.body?.confirm !== 'NUKE') {
      return res.status(400).json({ error: 'Can confirm=NUKE trong body' })
    }
    const deleted = store.deleteAllByGuild(GUILD())
    audit('nuke', { actor: actorOf(req), guildId: GUILD(), deletedCount: deleted, ip: req.ip })
    res.json({ deleted })
  } catch (err) {
    console.error('[roll-history:nuke]', err)
    res.status(500).json({ error: 'Internal' })
  }
})

// DELETE /api/roll-history?olderThanDays=N
router.delete('/', (req, res) => {
  try {
    const days = +req.query.olderThanDays
    if (!Number.isFinite(days) || days < 1) {
      return res.status(400).json({ error: 'olderThanDays phai >= 1' })
    }
    const cutoffSec = Math.floor(Date.now() / 1000) - days * 86400
    const deleted = store.deleteOlderThan({ guildId: GUILD(), cutoffSec })
    audit('clear-old-days', { actor: actorOf(req), guildId: GUILD(), days, deletedCount: deleted, ip: req.ip })
    res.json({ deleted })
  } catch (err) {
    console.error('[roll-history:clear]', err)
    res.status(500).json({ error: 'Internal' })
  }
})

module.exports = router
