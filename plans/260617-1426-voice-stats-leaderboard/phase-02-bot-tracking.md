# Phase 02 - Bot Tracking Logic

## Context Links
- Plan: [plan.md](plan.md)
- Phase 01: [phase-01-db-schema.md](phase-01-db-schema.md) (BLOCKER)
- Existing handler: `bot/src/events/voice-state-update.js`
- Existing ready: `bot/src/events/ready.js`

## Overview
- **Priority**: P2
- **Status**: pending
- **Mục tiêu**: ghi session vào DB khi user join/leave watched voice channel, handle bot restart đúng cách.

## Logic Flow

### `voiceStateUpdate` event (modify existing handler)

Sau khi đã tính `oldCh`, `newCh`, `watched`, **nếu** `isVoiceStatsEnabled(guildId)`:

```
wasWatched = oldCh && watched.includes(oldCh)
isWatched  = newCh && watched.includes(newCh)
now = Math.floor(Date.now() / 1000)

if (wasWatched && !isWatched)        → closeActiveSessions(guild, user, now)
else if (!wasWatched && isWatched)   → openSession(guild, user, newCh, now)
else if (wasWatched && isWatched && oldCh !== newCh)
                                      → closeActiveSessions + openSession
// else: cả hai đều ngoài watched, hoặc cùng channel (mute/deafen) → skip
```

Logic notify hiện tại giữ nguyên (chạy song song với tracking, không phụ thuộc).

### `ready` event (modify existing)

Khi bot ready, với mỗi guild:
1. `closeAllOrphans(now)` — đóng tất cả session leftover từ lần chạy trước (set `left_at = joined_at`, `duration_sec = 0`)
2. Scan voice states hiện tại:
   ```
   for each guild in client.guilds.cache:
     cfg = getVoiceLogSettings(guild.id)
     if (!isVoiceStatsEnabled(guild.id)) continue
     watched = cfg.watched_channels || []
     for each voiceState in guild.voiceStates.cache:
       if (voiceState.member.user.bot) continue
       if (watched.includes(voiceState.channelId)):
         openSession(guild.id, voiceState.id, voiceState.channelId, now)
   ```

## Related Code Files
- **Modify**: `bot/src/events/voice-state-update.js` (+ ~15 LOC)
- **Modify**: `bot/src/events/ready.js` (+ ~20 LOC) — nếu file chưa có handler ready, tạo mới
- **Read**: `shared/db-voice-stats.js` (từ phase 01)

## Implementation Steps

1. Đọc `ready.js` xem có handler chưa, nếu có → append logic, nếu không → tạo
2. Modify `voice-state-update.js`: thêm block tracking sau khi guild + cfg đã load
3. Test manual: enable feature, join voice → check DB có row, leave → check `left_at` + `duration_sec`
4. Test restart: join voice, kill bot, restart → check orphan đóng + session mới mở
5. Test switch giữa 2 watched channel: 2 row (cũ closed, mới open)

## Todo
- [ ] Modify voice-state-update.js
- [ ] Modify/create ready.js scan logic
- [ ] Manual test 4 scenario (join/leave/restart/switch)

## Success Criteria
- Join watched → 1 row active trong DB
- Leave watched → row có `left_at` và `duration_sec` đúng
- Bot restart không có row orphan sót lại
- Switch channel: row cũ close, row mới mở, không overlap
- `isVoiceStatsEnabled=false` → không INSERT gì

## Risks
- Race condition: 2 event nhanh liên tiếp → close trước, open sau (sequential trong handler nên OK)
- User offline lúc bot restart → state cache không có → miss session active cũ (orphan đã close = 0 sec, acceptable)
