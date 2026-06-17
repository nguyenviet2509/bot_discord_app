# Phase 03 - Slash Commands

## Context Links
- Plan: [plan.md](plan.md)
- Phase 01 helpers: [phase-01-db-schema.md](phase-01-db-schema.md)
- Reference command structure: `bot/src/commands/*.js`

## Overview
- **Priority**: P3
- **Status**: pending
- **Mục tiêu**: 2 slash command `/voicetop` và `/voicestats` (tách thành 2 file riêng hoặc 1 file 2 subcommand - chọn theo pattern hiện tại của bot).

## Commands Spec

### `/voicetop range:[choice] limit:[int=10]`
- **Visibility**: public (reply trong channel)
- **Options**:
  - `range`: choices `today` | `7d` | `30d` | `all` (default: `7d`)
  - `limit`: int 5-25 (default 10)
- **Output**: embed leaderboard
  ```
  🎙️ Top Voice - 7 ngày qua
  
  🥇 @user1  ─ 12h 34m  (45 lần)
  🥈 @user2  ─ 8h 12m   (32 lần)
  🥉 @user3  ─ 5h 03m   (28 lần)
  4. @user4  ─ 3h 45m   (19 lần)
  ...
  ```
- Resolve user display name từ guild.members.cache (fallback fetch)

### `/voicestats user:[optional] range:[choice]`
- **Visibility**: ephemeral
- **Options**:
  - `user`: User mention (default: caller)
  - `range`: same as above
- **Output**: embed cá nhân
  ```
  Voice Stats - @user (7 ngày qua)
  
  Tổng thời gian: 12h 34m
  Số lần join:    45
  Xếp hạng:       #1 / 47 members
  Channel ưa thích: #voice-1 (8h 12m)
  ```

## Helpers cần tạo

`bot/src/utils/format-duration.js`:
- `formatDuration(seconds)` → "12h 34m" hoặc "45m 12s" tuỳ scale
- `getRangeBounds(rangeKey)` → `{from, to}` (unix sec). `today` = từ 00:00 Asia/Saigon tới now. `7d`/`30d` = từ now - N*86400 tới now. `all` = `{from: 0, to: now}`

## Related Code Files
- **Create**: `bot/src/commands/voice-stats.js` (1 file 2 subcommand, hoặc tách 2 file `voicetop.js` + `voicestats.js` - check pattern)
- **Create**: `bot/src/utils/format-duration.js`
- **Read**: 1-2 command file hiện có để theo pattern register

## Implementation Steps

1. Đọc 1 command file (vd `bot/src/commands/*.js`) để nắm pattern slash builder + execute
2. Tạo `format-duration.js` + `getRangeBounds` (có thể chung 1 file utils)
3. Tạo command file(s):
   - SlashCommandBuilder với options
   - Execute: gọi helper DB → format embed → reply
4. Đảm bảo registration tự pickup (nếu bot có auto-load commands directory)
5. Test in-server: cả 2 command, các range, user khác

## Todo
- [ ] Đọc pattern command hiện có
- [ ] Tạo utils format-duration + getRangeBounds
- [ ] Tạo command(s)
- [ ] Test in-server 6+ scenarios (4 range × 2 cmd)

## Success Criteria
- `/voicetop range:7d limit:5` → embed top 5 đúng
- `/voicestats` không có user → stats của caller
- `/voicestats user:@other` → stats của user khác (vẫn ephemeral)
- Empty data → "Chưa có dữ liệu thống kê" thay vì error
- Member rời server → hiển thị fallback "Unknown user (id)"

## Risks
- User display name fetch chậm với top 25 → batch fetch hoặc rely cache
- Embed quá dài nếu top 25 → check character limit (4096 cho description)
