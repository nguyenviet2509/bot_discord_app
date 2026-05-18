# Phase 1 — Database Schema + CRUD

**Priority:** P0 (foundation)
**Status:** pending
**Effort:** S (~30 min)

## Overview
Thêm 2 bảng SQLite: `honor_history` (mỗi lần vinh danh) + `honor_settings` (config role/channel per guild). Tạo module CRUD riêng `shared/db-honor.js`.

## Related files
- **Modify:** `shared/db.js` (thêm `CREATE TABLE` vào `initDb()`)
- **Create:** `shared/db-honor.js`

## Schema

```sql
CREATE TABLE IF NOT EXISTS honor_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  title TEXT NOT NULL,
  banner_url TEXT,
  user1_id TEXT NOT NULL,
  user1_reason TEXT NOT NULL,
  user2_id TEXT NOT NULL,
  user2_reason TEXT NOT NULL,
  user3_id TEXT NOT NULL,
  user3_reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_honor_history_guild ON honor_history(guild_id, created_at DESC);

CREATE TABLE IF NOT EXISTS honor_settings (
  guild_id TEXT PRIMARY KEY,
  allowed_role_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array
  default_channel_id TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);
```

## CRUD API (`shared/db-honor.js`)

```js
// honor_settings
getHonorSettings(guildId)        // returns {guild_id, allowed_role_ids: [], default_channel_id}
upsertHonorSettings({guild_id, allowed_role_ids, default_channel_id})

// honor_history
insertHonorRecord(record)        // returns id
updateHonorMessageId(id, messageId)
listHonorHistory(guildId, limit = 10)
getHonorRecord(id)
```

Lưu ý: `allowed_role_ids` lưu JSON string, parse khi đọc.

## Implementation steps
1. Mở `shared/db.js`, thêm 2 `CREATE TABLE` vào hàm `initDb()` (sau bảng level_up_template)
2. Tạo `shared/db-honor.js`:
   - Import `getDb` từ `./db.js`
   - Implement 6 hàm CRUD
   - JSON parse/stringify cho `allowed_role_ids`
   - Export tất cả
3. Chạy `node -e "require('./shared/db').initDb()"` để verify bảng tạo OK

## Todo
- [ ] Thêm CREATE TABLE vào shared/db.js
- [ ] Tạo shared/db-honor.js với 6 hàm CRUD
- [ ] Verify migration chạy được

## Success criteria
- 2 bảng tồn tại sau khi gọi `initDb()`
- CRUD hoạt động đúng, `allowed_role_ids` parse JSON OK
