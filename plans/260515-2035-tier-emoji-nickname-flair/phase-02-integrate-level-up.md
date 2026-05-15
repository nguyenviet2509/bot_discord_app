# Phase 2 — Tích hợp vào handleLevelUp

**Priority:** High
**Status:** pending
**Effort:** ~15 min
**Depends on:** Phase 1

## Overview
Gọi `applyTierFlair` trong `handleLevelUp`, chỉ trigger khi **đổi tier** (không phải mỗi lần lên level).

## Related Files
- **Modify:** `bot/src/services/level-service.js` (function `handleLevelUp`).

## Implementation Steps

### 2.1 Detect tier change
`handleLevelUp(client, guild, member, newLevel, settings, triggerMessage)` hiện chỉ có `newLevel`. Cần `oldLevel` để so sánh tier.

Option A (KISS): suy ra từ DB. Trong `message-create.js` đã có `oldLevel` — pass thêm vào `handleLevelUp`.

**Đổi signature:** `handleLevelUp(client, guild, member, newLevel, settings, triggerMessage, oldLevel)`.

Sửa caller trong `bot/src/events/message-create.js:71`:
```js
await handleLevelUp(client, message.guild, member, newLevel, settings, message, oldLevel)
```

### 2.2 Áp flair trong handleLevelUp
Ở đầu `handleLevelUp` (sau khi assign role rewards), thêm:
```js
const { applyTierFlair } = require('./tier-flair-service')
const { getTierForLevel: getTier } = module.exports // hoặc dùng trực tiếp

const oldTier = getTierForLevel(oldLevel || 0)
const newTier = getTierForLevel(newLevel)
if (newTier.minLevel !== oldTier.minLevel && newLevel >= 10) {
  const user = db.getUser(member.id, guild.id)
  await applyTierFlair(member, newLevel, user)
}
```

**Lưu ý circular require:** `tier-flair-service` require `level-service`. Để tránh circular, require `tier-flair-service` **bên trong** function `handleLevelUp` (lazy load) HOẶC chuyển `LEVEL_TIERS` + `getTierForLevel` ra một file constants riêng. Chọn lazy require để giữ KISS.

## Todo
- [ ] Sửa signature `handleLevelUp` thêm param `oldLevel`
- [ ] Update caller `message-create.js`
- [ ] Lazy require `tier-flair-service` trong `handleLevelUp`
- [ ] Gọi `applyTierFlair` chỉ khi `newTier.minLevel !== oldTier.minLevel`
- [ ] Test thủ công với 1 member: set xp đủ lên tier mới → nick tự đổi

## Success Criteria
- Member chuyển từ lv 9 → lv 10 → nick có `⚫`.
- Member chuyển từ lv 19 → lv 20 → nick có `🟤` (badge `⚫` cũ bị strip).
- Member chuyển từ lv 11 → lv 12 (cùng tier Sắt) → KHÔNG gọi setNickname.

## Risks
- Circular require → mitigated bằng lazy require trong function.
- `oldLevel = 0` (user mới) + `newLevel = 1..9` → `newTier === oldTier` (cả 2 đều "Chưa xếp hạng"), không trigger. OK.
