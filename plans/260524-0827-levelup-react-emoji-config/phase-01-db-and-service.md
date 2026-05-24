# Phase 01 — DB Migration + Service Getter

## Goal
Thêm 2 cột config + hàm service đọc config.

## Files
- `shared/db.js`
- `bot/src/services/level-service.js`

## Steps

### 1. Migration `shared/db.js`
Sau khối `ALTER TABLE guild_tier_badges` hiện có (gần line 288-290):
```js
try { database.exec(`ALTER TABLE guild_tier_badges ADD COLUMN react_emoji TEXT`) } catch (_) {}
```

Tìm bảng `guild_settings` (CREATE TABLE), thêm:
```js
try { database.exec(`ALTER TABLE guild_settings ADD COLUMN levelup_react_chance_pct INTEGER NOT NULL DEFAULT 8`) } catch (_) {}
```

### 2. Helper truy cập DB
Thêm 2 hàm export trong `shared/db.js` (gần các getter khác):
```js
function getLevelupReactConfig(guildId, tierMinLevel) {
  const db = getDb()
  const row = db.prepare(
    'SELECT react_emoji FROM guild_tier_badges WHERE guild_id = ? AND tier_min_level = ?'
  ).get(guildId, tierMinLevel)
  const chanceRow = db.prepare(
    'SELECT levelup_react_chance_pct FROM guild_settings WHERE guild_id = ?'
  ).get(guildId)
  return {
    emoji: row?.react_emoji ?? null,
    chancePct: chanceRow?.levelup_react_chance_pct ?? 8,
  }
}

function listLevelupReactConfig(guildId) {
  const db = getDb()
  const rows = db.prepare(
    'SELECT tier_min_level, react_emoji FROM guild_tier_badges WHERE guild_id = ?'
  ).all(guildId)
  const chanceRow = db.prepare(
    'SELECT levelup_react_chance_pct FROM guild_settings WHERE guild_id = ?'
  ).get(guildId)
  return {
    perTier: rows, // [{ tier_min_level, react_emoji }]
    chancePct: chanceRow?.levelup_react_chance_pct ?? 8,
  }
}

function upsertLevelupReactEmoji(guildId, tierMinLevel, emoji) {
  const db = getDb()
  // emoji = null -> set NULL (tắt react tier đó)
  const existing = db.prepare(
    'SELECT 1 FROM guild_tier_badges WHERE guild_id = ? AND tier_min_level = ?'
  ).get(guildId, tierMinLevel)
  if (existing) {
    db.prepare(
      'UPDATE guild_tier_badges SET react_emoji = ?, updated_at = unixepoch() WHERE guild_id = ? AND tier_min_level = ?'
    ).run(emoji, guildId, tierMinLevel)
  } else {
    db.prepare(
      'INSERT INTO guild_tier_badges (guild_id, tier_min_level, badge, react_emoji) VALUES (?, ?, ?, ?)'
    ).run(guildId, tierMinLevel, '', emoji)
  }
}

function setLevelupReactChance(guildId, pct) {
  const clamped = Math.max(0, Math.min(100, parseInt(pct, 10) || 0))
  const db = getDb()
  const existing = db.prepare('SELECT 1 FROM guild_settings WHERE guild_id = ?').get(guildId)
  if (existing) {
    db.prepare('UPDATE guild_settings SET levelup_react_chance_pct = ? WHERE guild_id = ?').run(clamped, guildId)
  } else {
    db.prepare('INSERT INTO guild_settings (guild_id, levelup_react_chance_pct) VALUES (?, ?)').run(guildId, clamped)
  }
}
```
Export: `getLevelupReactConfig`, `listLevelupReactConfig`, `upsertLevelupReactEmoji`, `setLevelupReactChance`.

### 3. Service wrapper `bot/src/services/level-service.js`
Thêm cuối file:
```js
import { getLevelupReactConfig as dbGetReactConfig } from '../../../shared/db.js'

export function getLevelupReactConfig(guildId, level) {
  const tier = getTierForLevel(level)
  if (!tier?.minLevel) return { emoji: null, chancePct: 0 }
  const cfg = dbGetReactConfig(guildId, tier.minLevel)
  return {
    emoji: cfg.emoji ?? tier.badge, // fallback default badge nếu chưa config
    chancePct: cfg.chancePct,
  }
}
```
Lưu ý import path: kiểm tra cách `level-service.js` đang import từ `shared/db.js` (CJS hay ESM) → match đúng style.

## Done when
- `npm start` không lỗi.
- Query `SELECT react_emoji FROM guild_tier_badges` không lỗi cột.
- Query `SELECT levelup_react_chance_pct FROM guild_settings` trả default 8.
