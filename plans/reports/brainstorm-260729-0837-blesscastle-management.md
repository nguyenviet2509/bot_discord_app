# Brainstorm: BlessCastle Management

**Date:** 2026-07-29 08:37 (Asia/Saigon)
**Status:** Approved design, ready for /ck:plan

## Problem statement
Quản lý tham gia event BlessCastle hàng tuần + tích lũy sao đổi quà (3 sao = 1 phần quà). Multi-guild, có dashboard admin + slash command Discord.

## Requirements
### Functional
1. Điểm danh tuần (thứ 6):
   - **Auto**: voice trong khung 20:00-21:00 thứ 6 (Asia/Saigon), tổng ≥ 30 phút → đạt
   - **Manual**: admin tick trên dashboard trong khoảng T2 → 19:00 thứ 6
   - Chốt tuần lúc 21:00 thứ 6 → attended (manual OR auto) → `stars += 1`
2. Đổi quà: nút "Đã đổi quà" ở mỗi member row, enable khi `stars >= 3`. Bấm → tạo redemption log + reset `stars = 0`
3. Không đổi quà → giữ stars, tuần sau +1 tiếp
4. Discord commands: `/bc-stars [user]`, `/bc-leaderboard`
5. Multi-guild (per-guild config)
6. Member leave → soft-delete 7 ngày, rejoin trong 7 ngày → restore

### Non-functional
- Timezone: Asia/Saigon (dayjs-timezone)
- Consistent với dashboard-layout skill (indigo/slate, sticky header, JWT auth)
- Files ≤ 200 LOC (kebab-case, split theo concern)

## Data model (SQLite, mở rộng `shared/db.js`)

```sql
blesscastle_config (
  guild_id TEXT PRIMARY KEY,
  voice_channel_ids TEXT,          -- JSON array
  min_minutes INTEGER DEFAULT 30,
  session_start_hour INTEGER DEFAULT 20,
  session_end_hour INTEGER DEFAULT 21,
  enabled INTEGER DEFAULT 0
)

blesscastle_stars (
  guild_id TEXT, user_id TEXT,
  stars INTEGER DEFAULT 0,
  last_updated INTEGER,
  deleted_at INTEGER,              -- NULL = active; timestamp = soft-deleted
  PRIMARY KEY (guild_id, user_id)
)

blesscastle_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT, user_id TEXT,
  week_key TEXT,                   -- ISO week YYYY-WW
  voice_seconds INTEGER DEFAULT 0,
  attended_manual INTEGER DEFAULT 0,
  finalized INTEGER DEFAULT 0,
  UNIQUE(guild_id, user_id, week_key)
)

blesscastle_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT, user_id TEXT,
  admin_id TEXT,
  redeemed_at INTEGER,
  stars_at_redemption INTEGER
)
```

## Architecture

### Voice tracking
- Reuse voice state listener pattern (`bot/voice-stats` style)
- Filter: `channel_id ∈ config.voice_channel_ids` AND day = Friday AND hour ∈ [20,21)
- Accumulate seconds vào `blesscastle_attendance.voice_seconds` cho week hiện tại
- Bot restart mid-session → chấp nhận mất phần data đó (user confirm)

### Cron jobs
- `0 21 * * 5` (Asia/Saigon): finalize tuần
  - Với mỗi row attendance của tuần: `voice_seconds >= min_minutes*60 OR attended_manual` → `stars += 1`, `finalized = 1`
- `0 3 * * *` (daily): dọn soft-deleted `deleted_at < now - 7 days`

### Discord handlers
- `voiceStateUpdate`: track voice time trong khung
- `guildMemberRemove`: `deleted_at = now` (soft-delete stars + attendance)
- `guildMemberAdd`: nếu user có `deleted_at` trong 7 ngày → `deleted_at = NULL` (restore)

### Dashboard tab "BlessCastle"
- **Config card**: multi-select voice channels, min_minutes, session hours, enabled toggle
- **Members table**: search + sort by stars DESC
  - Avatar | Username | ⭐ Stars | Tuần này (voice X phút + badge manual) | [Tick tham gia] | [Đã đổi quà] (disabled < 3⭐)
- **Redemption history**: bảng log

### Discord commands
- `/bc-stars [user]` — embed: stars, tuần này progress, next reward at
- `/bc-leaderboard` — top 10 by stars DESC

## Files to create (kebab-case, ≤ 200 LOC each)
```
shared/db-blesscastle.js                         # schema init + CRUD helpers
bot/blesscastle/voice-attendance-tracker.js      # voiceStateUpdate listener
bot/blesscastle/weekly-finalize-cron.js          # Fri 21h cron
bot/blesscastle/soft-delete-cleanup-cron.js      # daily 3h cron
bot/blesscastle/member-leave-restore-handler.js  # guildMemberRemove + Add
bot/blesscastle/command-bc-stars.js
bot/blesscastle/command-bc-leaderboard.js
dashboard/routes/blesscastle.js                  # REST API endpoints
dashboard/public/js/blesscastle-tab.js           # Alpine.js component
```

Modify:
- `dashboard/public/index.html` — nav-item + tab section (theo dashboard-layout)
- `bot/index.js` — register handlers/commands/crons
- `shared/db.js` — call init từ db-blesscastle.js

## API endpoints (dashboard/routes/blesscastle.js)
```
GET    /api/blesscastle/:guildId/config
PUT    /api/blesscastle/:guildId/config
GET    /api/blesscastle/:guildId/members        # stars + current week progress
POST   /api/blesscastle/:guildId/attendance     # manual tick { userId }
DELETE /api/blesscastle/:guildId/attendance     # untick { userId }
POST   /api/blesscastle/:guildId/redeem         # { userId } → +log, reset stars
GET    /api/blesscastle/:guildId/redemptions    # history
GET    /api/blesscastle/:guildId/voice-channels # list voice channels of guild
```

## Risks & mitigations
| Risk | Mitigation |
|------|------------|
| Timezone lỗi (UTC vs VN) | Bắt buộc dayjs.tz('Asia/Saigon') mọi nơi tính ngày/tuần |
| Voice race condition (bot restart) | Chấp nhận (user confirm), log warning khi restart trong khung 20-21h thứ 6 |
| Manual tick sau 19h thứ 6 | UI disable nút manual sau 19h thứ 6 + validation server-side |
| Cron trùng | Check `bot/index.js` — hiện chưa có cron nào ở Fri 21h |
| Week key edge case (chủ nhật) | Dùng ISO week (Mon-Sun), finalize thứ 6 vẫn thuộc week đó |

## Success criteria
- Admin config voice channels + params trên dashboard, persist đúng
- Voice trong khung 20-21h thứ 6 được đếm chính xác (test 30 phút liên tục + gián đoạn)
- 21:00 thứ 6 auto-finalize → +1 sao cho ai đạt
- Manual tick T2 → 19h thứ 6 hoạt động, sau 19h disable
- Nút "Đã đổi quà" enable ≥ 3⭐, reset về 0 + tạo redemption log
- `/bc-stars` + `/bc-leaderboard` embed đúng data
- Leave/rejoin trong 7 ngày → restore stars

## Next steps
1. Chạy `/ck:plan` với context report này
2. Plan chia phase: DB schema → Voice tracker + cron → Discord commands → Dashboard API → Dashboard UI → Test end-to-end

## Unresolved questions
Không còn — mọi điểm đã confirm với user.
