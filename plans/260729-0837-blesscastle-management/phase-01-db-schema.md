# Phase 01: Database Schema

**Priority:** High | **Status:** pending

## Overview
Tạo schema SQLite + CRUD helpers cho BlessCastle. Mở rộng `shared/db.js` init.

## Files
- **Create:** `shared/db-blesscastle.js` (~200 LOC)
- **Modify:** `shared/db.js` — call `initBlessCastleSchema(db)`

## Schema

```sql
CREATE TABLE IF NOT EXISTS blesscastle_config (
  guild_id TEXT PRIMARY KEY,
  voice_channel_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array
  min_minutes INTEGER NOT NULL DEFAULT 30,
  session_start_hour INTEGER NOT NULL DEFAULT 20,
  session_end_hour INTEGER NOT NULL DEFAULT 21,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS blesscastle_stars (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  stars INTEGER NOT NULL DEFAULT 0,
  last_updated INTEGER,
  deleted_at INTEGER,
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_bc_stars_active ON blesscastle_stars(guild_id, stars DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS blesscastle_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  week_key TEXT NOT NULL,             -- YYYY-WW (ISO)
  voice_seconds INTEGER NOT NULL DEFAULT 0,
  attended_manual INTEGER NOT NULL DEFAULT 0,
  finalized INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER,
  UNIQUE(guild_id, user_id, week_key)
);
CREATE INDEX IF NOT EXISTS idx_bc_att_week ON blesscastle_attendance(guild_id, week_key);

CREATE TABLE IF NOT EXISTS blesscastle_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  admin_id TEXT NOT NULL,
  redeemed_at INTEGER NOT NULL,
  stars_at_redemption INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bc_redemp ON blesscastle_redemptions(guild_id, redeemed_at DESC);
```

## Helpers to export (`shared/db-blesscastle.js`)

```js
initBlessCastleSchema(db)

// Config
getConfig(guildId) -> {voiceChannelIds:[], minMinutes, sessionStartHour, sessionEndHour, enabled}
upsertConfig(guildId, patch)

// Stars
getStars(guildId, userId)
listActiveStars(guildId) -> [{userId, stars, lastUpdated}] (deleted_at IS NULL, ORDER BY stars DESC)
incrementStars(guildId, userId, delta=1)
resetStars(guildId, userId)  // set stars=0
softDeleteUser(guildId, userId)  // deleted_at = now
restoreUser(guildId, userId)     // deleted_at = NULL
purgeSoftDeleted(olderThanTs)    // hard delete stars + attendance where deleted_at < ts

// Attendance
addVoiceSeconds(guildId, userId, weekKey, seconds)
setManualAttendance(guildId, userId, weekKey, value)  // 0 or 1
getWeekAttendance(guildId, weekKey) -> [{userId, voiceSeconds, attendedManual, finalized}]
getUserWeekAttendance(guildId, userId, weekKey)
finalizeWeek(guildId, weekKey, minSeconds) -> {awarded: [userIds]}
  // For each row not finalized: if voice_seconds >= minSeconds OR attended_manual → stars+=1
  // Mark finalized=1

// Redemptions
createRedemption(guildId, userId, adminId, starsAt)
listRedemptions(guildId, limit=50)
```

## ISO week key
- Use dayjs with `isoWeek` plugin OR native calc
- `weekKey = dayjs().tz('Asia/Saigon').format('GGGG-WW')`

## Todo
- [ ] Init dayjs plugins (utc, timezone, isoWeek) trong file này nếu chưa có global
- [ ] SCHEMA_SQL + `initBlessCastleSchema`
- [ ] All CRUD helpers với prepared statements (cache statements)
- [ ] Import + call trong `shared/db.js` initialize function
- [ ] Test: insert config, upsert, list stars sorted

## Success Criteria
- Chạy bot lần đầu → 4 bảng được tạo, không lỗi
- Helpers hoạt động (unit test qua node -e nếu cần)
- Không phá schema existing (voice_stats, honor,...)

## Risks
- Dayjs plugin chưa init global → import + `.extend()` local
- ISO week edge case tuần chuyển năm (dayjs `GGGG-WW` handle đúng)
