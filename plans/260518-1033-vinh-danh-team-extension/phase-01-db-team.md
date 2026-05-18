# Phase 1 — DB Schema + CRUD `honor_team_history`

**Priority:** P0
**Effort:** S (~20 min)

## Schema

```sql
CREATE TABLE IF NOT EXISTS honor_team_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  title TEXT NOT NULL,
  team_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  banner_url TEXT,
  member_ids TEXT NOT NULL,  -- JSON array of user IDs
  created_by TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_honor_team_guild ON honor_team_history(guild_id, created_at DESC);
```

## CRUD API thêm vào `shared/db-honor.js`

```js
insertHonorTeamRecord(record)        // returns id
updateHonorTeamMessageId(id, msgId)
listHonorTeamHistory(guildId, limit = 10)
getHonorTeamRecord(id)
```

`member_ids` lưu JSON string, parse khi đọc trong `listHonorTeamHistory`.

## Files modify
- `shared/db.js` — add CREATE TABLE vào `initDb()` (sau honor_settings)
- `shared/db-honor.js` — thêm 4 hàm CRUD

## Todo
- [ ] CREATE TABLE vào db.js
- [ ] CRUD trong db-honor.js
- [ ] Verify migration

## Success criteria
- Bảng tạo OK sau `initDb()`
- CRUD insert + update + list hoạt động, parse JSON member_ids
