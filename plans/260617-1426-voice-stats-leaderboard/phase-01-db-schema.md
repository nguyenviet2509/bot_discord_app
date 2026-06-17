# Phase 01 - DB Schema + Helpers

## Context Links
- Plan: [plan.md](plan.md)
- Existing module pattern: `shared/db-automod.js`, `shared/db-events.js`

## Overview
- **Priority**: P2 (foundation - block phase 2+)
- **Status**: pending
- **Mục tiêu**: tạo module `shared/db-voice-stats.js` chứa schema + tất cả query helpers cho voice statistics.

## Schema

```sql
CREATE TABLE IF NOT EXISTS voice_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,     -- unix seconds
  left_at INTEGER,                -- NULL = đang active
  duration_sec INTEGER            -- NULL khi chưa close
);
CREATE INDEX IF NOT EXISTS idx_vs_guild_user_time
  ON voice_sessions(guild_id, user_id, joined_at);
CREATE INDEX IF NOT EXISTS idx_vs_active
  ON voice_sessions(guild_id, user_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vs_guild_time
  ON voice_sessions(guild_id, joined_at);
```

Thêm cột `voice_stats_enabled INTEGER DEFAULT 1` vào table `voice_log_settings` (ALTER TABLE migration).

## Helpers cần expose (export từ `db-voice-stats.js`)

```js
// Tracking
openSession(guildId, userId, channelId, joinedAt)          // INSERT, return id
closeActiveSessions(guildId, userId, leftAt)               // UPDATE active rows của user → set left_at, duration_sec
closeAllOrphans(now)                                       // UPDATE all left_at IS NULL → set left_at=joined_at, duration_sec=0 (gọi khi bot ready)
hasActiveSession(guildId, userId)                          // boolean

// Settings
isVoiceStatsEnabled(guildId)                               // đọc voice_log_settings.voice_stats_enabled
setVoiceStatsEnabled(guildId, enabled)                     // UPDATE

// Query (leaderboard)
getLeaderboard(guildId, fromTs, toTs, limit = 10)
// SELECT user_id, SUM(duration cap 24h) AS total_sec, COUNT(*) AS join_count
// WHERE guild_id=? AND joined_at >= ? AND joined_at < ?
//   AND (left_at IS NOT NULL)
// GROUP BY user_id ORDER BY total_sec DESC LIMIT ?

getUserStats(guildId, userId, fromTs, toTs)
// total_sec, join_count, rank, top_channel_id

getTopChannelForUser(guildId, userId, fromTs, toTs)
```

**Duration cap logic** (chống AFK): trong SUM, dùng `MIN(duration_sec, 86400)`.

## Related Code Files
- **Create**: `shared/db-voice-stats.js` (~150 LOC)
- **Modify**: `shared/db.js` (re-export module mới, gọi init schema). Theo pattern các db-*.js khác xem cách hook vào db.js
- **Modify**: column add cho `voice_log_settings` (ALTER TABLE IF NOT EXISTS pattern - SQLite cần check pragma)

## Implementation Steps

1. Đọc `shared/db.js` + 1 file `shared/db-*.js` để nắm pattern init schema + export
2. Tạo `shared/db-voice-stats.js`:
   - Init schema (CREATE TABLE/INDEX IF NOT EXISTS)
   - Migration ALTER TABLE `voice_log_settings` ADD COLUMN (try/catch nếu cột đã tồn tại - SQLite không có IF NOT EXISTS cho ADD COLUMN, dùng PRAGMA table_info check trước)
   - Prepared statements top-level
   - Export helpers liệt kê trên
3. Hook init vào `shared/db.js` (require + gọi init)
4. Smoke test: chạy `node -e "require('./shared/db')"` không lỗi

## Todo
- [ ] Đọc pattern module db-* hiện có
- [ ] Tạo `db-voice-stats.js` schema + migration
- [ ] Viết 8 helpers
- [ ] Hook vào `db.js`
- [ ] Smoke test require

## Success Criteria
- `node -e "const d=require('./shared/db'); d.openSession('1','2','3', 1000); console.log(d.hasActiveSession('1','2'))"` → true
- Migration idempotent (chạy 2 lần không lỗi)
- File <200 LOC

## Risks
- ALTER TABLE ADD COLUMN không hỗ trợ IF NOT EXISTS → cần PRAGMA check trước
- Index partial WHERE clause: better-sqlite3 hỗ trợ (SQLite 3.8+) ✓
