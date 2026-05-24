# Phase 02 — Bot Event Integration

## Goal
Thay logic hard-code react ở `message-create.js` bằng config động.

## Files
- `bot/src/events/message-create.js`

## Steps

### 1. Import getter
Thêm vào import block:
```js
import { getLevelupReactConfig } from '../services/level-service.js'
```
(điều chỉnh path/style theo file hiện tại — kiểm tra import của `getTierForLevel`)

### 2. Replace block line 112-121
Trước:
```js
if (newLevel >= 10 && Math.random() < 0.08) {
  const tier = getTierForLevel(newLevel)
  try {
    await message.react(tier.badge)
  } catch (_) {}
}
```

Sau:
```js
if (newLevel >= 10) {
  const { emoji, chancePct } = getLevelupReactConfig(message.guildId, newLevel)
  if (emoji && chancePct > 0 && Math.random() * 100 < chancePct) {
    try {
      await message.react(emoji)
    } catch (_) {
      // Ignore: emoji không khả dụng / thiếu quyền / format sai
    }
  }
}
```

### 3. Lưu ý
- Giữ điều kiện `newLevel >= 10` (chưa xếp hạng thì không react).
- `Math.random() * 100 < chancePct` → đúng public của `chancePct` đơn vị %.

## Done when
- Bot khởi động không lỗi.
- Level-up user level≥10 — bot vẫn react như cũ (vì default `chancePct=8`, `emoji=null` → fallback badge tier).
