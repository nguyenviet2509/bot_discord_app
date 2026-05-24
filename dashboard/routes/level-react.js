// Dashboard route cho auto-react emoji khi user level-up
// GET /api/level-react           -> { chancePct, perTier: [{ tier_min_level, react_emoji }] }
// PUT /api/level-react  body: { chancePct, perTier: [{ tier_min_level, react_emoji }] }
const express = require('express')
const db = require('../../shared/db')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

// 10 tier moc level chuan (Sat -> Thach Dau) — phai match LEVEL_TIERS o level-service.js
const TIER_MIN_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

router.get('/', (req, res) => {
  const cfg = db.listLevelupReactConfig(GUILD_ID())
  // Normalize: dam bao tra du 10 tier (NULL neu chua config)
  const map = new Map(cfg.perTier.map((r) => [r.tier_min_level, r.react_emoji]))
  const perTier = TIER_MIN_LEVELS.map((lv) => ({
    tier_min_level: lv,
    react_emoji: map.get(lv) ?? null,
  }))
  res.json({ chancePct: cfg.chancePct, perTier })
})

router.put('/', (req, res) => {
  const { chancePct, perTier } = req.body || {}

  // Set chance (clamp xu ly trong db helper)
  if (chancePct !== undefined) {
    db.setLevelupReactChance(GUILD_ID(), chancePct)
  }

  // Persist tung tier
  if (Array.isArray(perTier)) {
    for (const item of perTier) {
      if (!TIER_MIN_LEVELS.includes(item?.tier_min_level)) continue
      const emoji = sanitizeEmoji(item.react_emoji)
      db.upsertLevelupReactEmoji(GUILD_ID(), item.tier_min_level, emoji)
    }
  }

  res.json({ ok: true })
})

// Sanitize emoji input: trim, cho phep Unicode + custom format `<:name:id>` hoac `<a:name:id>`
// Tra ve null neu rong de tat react tier do
function sanitizeEmoji(raw) {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (!s) return null
  // Reject neu qua dai (custom emoji max ~50 ky tu, Unicode 1-8 code points)
  if (s.length > 100) return null
  return s
}

module.exports = router
