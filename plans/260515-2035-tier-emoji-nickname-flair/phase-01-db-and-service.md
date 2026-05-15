# Phase 1 — DB Migration + tier-flair-service (Custom Badge)

**Priority:** High
**Status:** pending
**Effort:** ~40 min

## Overview
Thêm cột `flair_enabled` vào `users`, tạo bảng `guild_tier_badges` lưu override per-guild per-tier, tạo module `tier-flair-service.js` (pure logic, dynamic badge lookup, generic emoji strip).

## Related Files
- **Modify:** `shared/db.js` — migrations + helpers.
- **Create:** `bot/src/services/tier-flair-service.js`.
- **Read context:** `bot/src/services/level-service.js` (`LEVEL_TIERS`, `getTierForLevel`).

## Implementation Steps

### 1.1 Migration `users.flair_enabled`
Trong khối ALTER (gần line 211 của `shared/db.js`):
```js
try { database.exec(`ALTER TABLE users ADD COLUMN flair_enabled INTEGER DEFAULT 1`) } catch (_) {}
```

### 1.2 Bảng `guild_tier_badges`
Thêm vào `initDb()`:
```sql
CREATE TABLE IF NOT EXISTS guild_tier_badges (
  guild_id TEXT NOT NULL,
  tier_min_level INTEGER NOT NULL,
  badge TEXT NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (guild_id, tier_min_level)
);
```

### 1.3 Helpers trong `shared/db.js`
```js
function setFlairEnabled(userId, guildId, enabled) {
  getDb().prepare(`UPDATE users SET flair_enabled = ? WHERE id = ? AND guild_id = ?`)
    .run(enabled ? 1 : 0, userId, guildId)
}

function getTierBadgeOverrides(guildId) {
  // Trả về Map<tier_min_level, badge>
  const rows = getDb().prepare(
    `SELECT tier_min_level, badge FROM guild_tier_badges WHERE guild_id = ?`
  ).all(guildId)
  const map = new Map()
  for (const r of rows) map.set(r.tier_min_level, r.badge)
  return map
}

function setTierBadge(guildId, tierMinLevel, badge) {
  getDb().prepare(`
    INSERT INTO guild_tier_badges (guild_id, tier_min_level, badge, updated_at)
    VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(guild_id, tier_min_level) DO UPDATE
      SET badge = excluded.badge, updated_at = excluded.updated_at
  `).run(guildId, tierMinLevel, badge)
}

function resetTierBadge(guildId, tierMinLevel) {
  if (tierMinLevel == null) {
    getDb().prepare(`DELETE FROM guild_tier_badges WHERE guild_id = ?`).run(guildId)
  } else {
    getDb().prepare(`DELETE FROM guild_tier_badges WHERE guild_id = ? AND tier_min_level = ?`)
      .run(guildId, tierMinLevel)
  }
}
```
Export tất cả.

### 1.4 `tier-flair-service.js`

```js
const { LEVEL_TIERS, getTierForLevel } = require('./level-service')
const db = require('../../../shared/db')

// Generic regex strip mọi trailing emoji + ZWJ + skin tone
// \p{Extended_Pictographic} bao quát Unicode emoji
const STRIP_REGEX = /\s*[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]+(?:\s*[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]+)*\s*$/u

// Validate input emoji: phải chứa ít nhất 1 ký tự emoji, ngắn (<= 8 chars để loại trừ <:custom:id>)
const VALID_EMOJI_REGEX = /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]+$/u

function isValidBadge(input) {
  if (!input || input.length > 8) return false
  return VALID_EMOJI_REGEX.test(input)
}

function stripTierBadges(name) {
  if (!name) return ''
  return name.replace(STRIP_REGEX, '').trim()
}

function getBadgeForTier(guildId, tier) {
  if (!tier?.badge) return null
  const overrides = db.getTierBadgeOverrides(guildId)
  return overrides.get(tier.minLevel) || tier.badge
}

function buildFlairNickname(baseName, badge) {
  const base = stripTierBadges(baseName)
  let nick = `${base} ${badge}`
  if (nick.length <= 32) return nick
  const maxBase = 32 - badge.length - 1
  return `${base.slice(0, maxBase).trim()} ${badge}`
}

async function applyTierFlair(member, newLevel, user) {
  if (!user || user.flair_enabled === 0) return false
  if (newLevel < 10) return false
  const tier = getTierForLevel(newLevel)
  const badge = getBadgeForTier(member.guild.id, tier)
  if (!badge) return false
  if (!member.manageable) {
    console.warn(`[Flair] Skip ${member.id}: not manageable`)
    return false
  }
  const baseRaw = member.nickname || member.user.globalName || member.user.username
  const newNick = buildFlairNickname(baseRaw, badge)
  if (newNick === member.nickname) return true
  try {
    await member.setNickname(newNick, 'Tier flair update')
    return true
  } catch (err) {
    console.warn(`[Flair] setNickname fail ${member.id}:`, err.message)
    return false
  }
}

async function removeFlair(member) {
  if (!member.nickname) return true
  const stripped = stripTierBadges(member.nickname)
  if (stripped === member.nickname) return true
  if (!member.manageable) return false
  try {
    await member.setNickname(stripped || null, 'Flair opt-out / reset')
    return true
  } catch (err) {
    console.warn(`[Flair] removeFlair fail ${member.id}:`, err.message)
    return false
  }
}

module.exports = {
  isValidBadge,
  stripTierBadges,
  buildFlairNickname,
  getBadgeForTier,
  applyTierFlair,
  removeFlair,
}
```

## Todo
- [ ] Migration `users.flair_enabled`
- [ ] Bảng `guild_tier_badges` + 4 helpers
- [ ] Tạo `tier-flair-service.js`
- [ ] Verify regex strip với emoji default + 1 custom emoji thử nghiệm
- [ ] Bot start OK, không lỗi

## Success Criteria
- `stripTierBadges('Tohma 🩵')` → `'Tohma'`.
- `stripTierBadges('Tohma 🦄')` (emoji lạ) → `'Tohma'` (generic regex bắt mọi emoji).
- `isValidBadge('🦄')` → true; `isValidBadge('<:rare:123>')` → false; `isValidBadge('abc')` → false.
- `getBadgeForTier(guildId, tier)` → trả override nếu có, fallback `tier.badge`.

## Risks
- Regex `\p{Extended_Pictographic}` cần Node ≥ 12 (đã có).
- Strip generic có thể "ăn" emoji user tự thêm vào cuối nick (chấp nhận — feature focus).
- Custom emoji Discord (`<:name:id>`) bị reject ở `isValidBadge` → guide admin chọn Unicode.
