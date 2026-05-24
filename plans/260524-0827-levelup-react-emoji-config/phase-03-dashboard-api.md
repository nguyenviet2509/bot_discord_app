# Phase 03 — Dashboard API Route

## Goal
Tạo route GET/PUT để load/save react emoji per-tier + chance %.

## Files
- `dashboard/routes/level-react.js` (new)
- `dashboard/server.js` (hoặc nơi register router) — đăng ký

## Steps

### 1. Tạo `dashboard/routes/level-react.js`
Tham khảo style các route khác trong `dashboard/routes/` (vd `honor.js`, `welcome-template.js`) — copy pattern auth/JWT.

```js
import express from 'express'
import { listLevelupReactConfig, upsertLevelupReactEmoji, setLevelupReactChance } from '../../shared/db.js'
import { authRequired } from '../middleware/auth.js' // path theo project

const router = express.Router()

const TIER_MIN_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

// GET /api/level-react?guildId=...
router.get('/level-react', authRequired, (req, res) => {
  const { guildId } = req.query
  if (!guildId) return res.status(400).json({ error: 'guildId required' })
  const cfg = listLevelupReactConfig(guildId)
  // Normalize: đảm bảo trả đủ 10 tier (NULL nếu chưa config)
  const map = new Map(cfg.perTier.map(r => [r.tier_min_level, r.react_emoji]))
  const perTier = TIER_MIN_LEVELS.map(lv => ({
    tier_min_level: lv,
    react_emoji: map.get(lv) ?? null,
  }))
  res.json({ chancePct: cfg.chancePct, perTier })
})

// PUT /api/level-react
// Body: { guildId, chancePct, perTier: [{ tier_min_level, react_emoji }] }
router.put('/level-react', authRequired, (req, res) => {
  const { guildId, chancePct, perTier } = req.body || {}
  if (!guildId) return res.status(400).json({ error: 'guildId required' })

  // Validate chancePct
  const pct = Math.max(0, Math.min(100, parseInt(chancePct, 10) || 0))
  setLevelupReactChance(guildId, pct)

  // Validate + persist mỗi tier
  if (Array.isArray(perTier)) {
    for (const item of perTier) {
      if (!TIER_MIN_LEVELS.includes(item.tier_min_level)) continue
      const emoji = sanitizeEmoji(item.react_emoji)
      upsertLevelupReactEmoji(guildId, item.tier_min_level, emoji)
    }
  }
  res.json({ ok: true })
})

function sanitizeEmoji(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null
  // Cho phép Unicode + custom format <:name:id> / <a:name:id>
  // Reject string quá dài để tránh injection
  if (s.length > 100) return null
  return s
}

export default router
```

### 2. Register router
Mở file dashboard entrypoint (search `app.use('/api'` hoặc tương tự), thêm:
```js
import levelReactRouter from './routes/level-react.js'
app.use('/api', levelReactRouter)
```

### 3. Lưu ý
- Match auth middleware đang dùng (JWT từ login.html).
- CORS / rate limit: theo middleware sẵn có, không thêm mới.

## Done when
- `curl -H "Authorization: Bearer <token>" 'http://localhost:PORT/api/level-react?guildId=...'` trả JSON đúng shape.
- PUT update DB thành công, GET sau đó phản ánh giá trị mới.
