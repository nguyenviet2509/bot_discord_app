# Phase 01 — DB Schema + Seed 32 Teams

## Context

- Brainstorm: [brainstorm-260615-1001-worldcup-match-notifications.md](../reports/brainstorm-260615-1001-worldcup-match-notifications.md)
- Tham khảo pattern DB hiện tại: `shared/db.js`, các module khác extend bảng tại đây.

## Overview

- Priority: P0
- Status: pending
- Tạo 4 bảng SQLite + 1 row `app_settings` cho owner role + seed 32 đội Worldcup (chỉ name + code, KHÔNG dùng flag emoji).

## Requirements

### Functional
- Migration tự chạy khi bot start (idempotent — `CREATE TABLE IF NOT EXISTS`).
- Seed 32 đội: chạy 1 lần, skip nếu đã có data.
- Lưu `worldcup_admin_role_id` trong `app_settings` (key/value).

### Non-functional
- Schema reflect đúng brainstorm. Index trên `kick_off_at + status` để query scheduler nhanh.

## Files

### Create
- `bot/src/modules/worldcup/db/migrate.js` — định nghĩa 4 bảng + ensure index.
- `bot/src/modules/worldcup/db/seed-teams.js` — array 32 đội + flag emoji + code, insert nếu rỗng.
- `bot/src/modules/worldcup/db/index.js` — export `runMigrations(db)`, `seedTeams(db)`.

### Modify
- `shared/db.js` — gọi `runMigrations` + `seedTeams` của module worldcup khi init (hoặc trong `register.js` Phase 02). Quyết định: gọi trong register module để giữ module tự cô lập.

## Schema (tóm tắt — chi tiết xem brainstorm §4.2)

```sql
worldcup_teams (id, code UNIQUE, name, created_at)
worldcup_matches (id, team1_id, team2_id, kick_off_at, round, group_name,
                  status DEFAULT 'scheduled', created_at, updated_at)
  INDEX idx_matches_kickoff (kick_off_at, status)
worldcup_guild_config (guild_id PK, enabled, channel_id, notify_before_minutes DEFAULT 30,
                       role_ping_id, timezone DEFAULT 'Asia/Saigon', updated_at)
worldcup_notification_log (match_id, guild_id, sent_at, PRIMARY KEY (match_id, guild_id))

app_settings (key PK, value, updated_at)  -- tạo nếu chưa có, lưu worldcup_admin_role_id
```

## Seed data — 32 đội WC

Sample format (file `seed-teams.js`):
```js
module.exports = [
  { code: 'QAT', name: 'Qatar' },
  { code: 'ECU', name: 'Ecuador' },
  { code: 'SEN', name: 'Senegal' },
  { code: 'NED', name: 'Hà Lan' },
  { code: 'ENG', name: 'Anh' },
  { code: 'USA', name: 'Mỹ' },
  { code: 'BRA', name: 'Brazil' },
  { code: 'ARG', name: 'Argentina' },
  // ... (32 đội tổng, lấy WC 2022 + có thể update sau)
]
```
**Note:** danh sách cụ thể có thể dùng WC 2022 hoặc 2026 (48 đội). Quyết định: seed 32 đội WC 2022 làm template, admin thêm/sửa qua dashboard sau.

## Steps

1. Tạo `bot/src/modules/worldcup/db/migrate.js`:
   - Export `runMigrations(db)` — exec 4 CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
   - Ensure `app_settings` table exists (check trong shared/db.js trước, nếu có rồi thì skip).
2. Tạo `seed-teams.js` — export array data.
3. Tạo `db/index.js`:
   - `runMigrations(db)`.
   - `seedTeams(db)` — `SELECT COUNT(*) FROM worldcup_teams`, nếu 0 thì bulk insert.
4. Test thủ công: xoá `database.sqlite`, chạy bot, verify bảng tạo + 32 row trong `worldcup_teams`.

## Todo

- [ ] Tạo `migrate.js` với 4 CREATE TABLE
- [ ] Tạo `seed-teams.js` với 32 đội (code + name, không flag emoji)
- [ ] Tạo `db/index.js` export wrapper
- [ ] Verify `app_settings` table tồn tại (tạo nếu chưa có)
- [ ] Smoke check: bảng + index + seed data đúng

## Success criteria

- Bot start không lỗi.
- `SELECT COUNT(*) FROM worldcup_teams` = 32.
- `EXPLAIN QUERY PLAN SELECT * FROM worldcup_matches WHERE kick_off_at BETWEEN ? AND ? AND status='scheduled'` dùng `idx_matches_kickoff`.

## Risks

- Conflict `app_settings` schema nếu đã tồn tại với shape khác → check trước, không tạo lại nếu đã có.

## Next

Phase 02 — module skeleton + stores.
