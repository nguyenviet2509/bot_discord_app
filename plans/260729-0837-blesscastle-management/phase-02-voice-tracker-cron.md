# Phase 02: Voice Tracker + Weekly Cron + Cleanup Cron

**Priority:** High | **Status:** pending
**Depends on:** Phase 01

## Overview
Track voice time trong khung Fri 20-21h (Asia/Saigon), cộng vào `blesscastle_attendance.voice_seconds`. Cron chốt tuần Fri 21h → +1⭐. Cron daily 03h → purge soft-deleted > 7 ngày.

## Files
- **Create:**
  - `bot/src/events/blesscastle-voice-tracker.js` (~180 LOC) — voiceStateUpdate hook
  - `bot/src/crons/blesscastle-weekly-finalize.js` (~100 LOC)
  - `bot/src/crons/blesscastle-soft-delete-cleanup.js` (~60 LOC)
- **Modify:**
  - `bot/src/events/voice-state-update.js` — gọi thêm hook BlessCastle tracker
  - `bot/index.js` (hoặc bootstrap file) — register 2 crons

## Voice tracker logic

Reuse pattern voice-stats:
- Trên `voiceStateUpdate`:
  - **Join** (`oldState.channelId == null && newState.channelId`): nếu channel ∈ config.voiceChannelIds → lưu `joinTime[userId] = now`
  - **Move**: xử lý như leave old + join new
  - **Leave**: nếu có `joinTime[userId]` → tính `elapsed`, gọi `commitInterval(guildId, userId, joinFrom, joinTo)` → clip vào khung Fri 20-21h Asia/Saigon → cộng vào `voice_seconds` tuần đó
- In-memory Map, không persist → restart mất (đã confirm)

```js
function clipToFridayWindow(fromMs, toMs, cfg) {
  // Return seconds trong [fromMs, toMs] ∩ (Friday session_start_hour..session_end_hour)
  // Iterate qua các ngày trong khoảng (thường 1 phiên < 24h)
}

function currentWeekKey() {
  return dayjs().tz('Asia/Saigon').format('GGGG-WW')
}
```

**Edge case:** user đang trong voice khi bot restart → join event miss → không track được phiên đang có. Chấp nhận (KISS).

## Weekly finalize cron
- Schedule: `'0 21 * * 5'` timezone `Asia/Saigon`
- Với mỗi guild có config `enabled=1`:
  - `weekKey = currentWeekKey()`
  - Gọi `finalizeWeek(guildId, weekKey, minMinutes*60)`
  - Log số user awarded

```js
const cron = require('node-cron')  // check dependency, hoặc lib đã dùng
cron.schedule('0 21 * * 5', () => finalizeAll(), { timezone: 'Asia/Saigon' })
```

## Cleanup cron
- Schedule: `'0 3 * * *'` Asia/Saigon
- `purgeSoftDeleted(now - 7*86400*1000)`

## Config change → reload channels
- Không cần: mỗi lần voice event → `getConfig(guildId)` fresh (đủ nhanh với SQLite prepared stmt)

## Todo
- [ ] Check package.json xem lib cron nào đang dùng (`node-cron` / `croner` / setTimeout loop)
- [ ] Voice tracker: joinTime Map, join/leave/move handlers
- [ ] `clipToFridayWindow` helper (unit-testable)
- [ ] Wire vào existing `voice-state-update.js` event
- [ ] Weekly cron file + register in bot bootstrap
- [ ] Cleanup cron file + register
- [ ] Log rõ ràng khi finalize (số user, weekKey)

## Success Criteria
- Join voice channel BC lúc 20:15 Fri, leave 20:50 → attendance record 35*60 seconds
- 21:00 Fri cron chạy → user có ≥30' → stars +1, finalized=1
- User leave guild → sau 7 ngày cron xóa hết record

## Risks
- Timezone bug (UTC vs Saigon): dayjs.tz phải extend đủ plugin
- Cron trùng lịch: check hiện tại chưa có cron 21h Fri
- Move channel ngoài BC channel → phải commit interval trước khi clear joinTime
