# Phase 01 — DB Schema & Backend Routes

**Status:** pending
**Priority:** high
**Effort:** ~2h

## Context
- Reuse pattern: [shared/db.js:85-105](../../shared/db.js#L85-L105) (`scheduled_message_groups` + `scheduled_messages`)
- Reuse route style: [dashboard/routes/scheduled-messages.js](../../dashboard/routes/scheduled-messages.js)

## Schema (append vào `shared/db.js`)

```sql
CREATE TABLE IF NOT EXISTS event_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  group_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 0,
  start_at INTEGER,
  end_at INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_events_guild_group ON events(guild_id, group_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_event_groups_guild ON event_groups(guild_id, sort_order);
```

## Routes — `dashboard/routes/events.js` (NEW)

| Method | Path | Body / Query |
|---|---|---|
| GET | `/api/events/groups` | `?guild_id` → `[{id, name, sort_order, event_count}]` |
| POST | `/api/events/groups` | `{guild_id, name}` |
| PATCH | `/api/events/groups/:id` | `{name}` |
| DELETE | `/api/events/groups/:id` | events trong group → `group_id=NULL` |
| PATCH | `/api/events/groups/reorder` | `{guild_id, orderedIds: [int]}` |
| GET | `/api/events` | `?guild_id&group_id(null|int)&page=1&limit=10` → `{items, total, page, limit}` |
| POST | `/api/events` | `{guild_id, group_id?, name, description?, type, status?, start_at?, end_at?}` |
| PATCH | `/api/events/:id` | partial update |
| DELETE | `/api/events/:id` | hard delete |
| PATCH | `/api/events/reorder` | `{guild_id, updates: [{id, group_id, sort_order}]}` — atomic transaction |
| GET | `/api/events/types` | `?guild_id&group_id` → list type strings (built-in + DISTINCT từ events trong group đó) |

### Implementation notes
- Validate `guild_id` từ JWT middleware (theo pattern routes hiện có)
- `PATCH /reorder` dùng `db.transaction(() => updates.forEach(...))` để atomic
- `GET /api/events` với `group_id=null` → SQL `group_id IS NULL`
- Tất cả `updated_at` set bằng `unixepoch()` khi PATCH
- `GET /api/events/types`: merge built-in `['giveaway','raffle','trivia']` + SQL `SELECT DISTINCT type FROM events WHERE guild_id=? AND group_id IS ?` (hoặc `= ?`), dedupe, trả array string. Backend validate type regex `^[a-z0-9_-]{1,30}$` khi POST/PATCH event.

## Files
- **Edit:** `shared/db.js` (append 2 CREATE TABLE + 2 INDEX)
- **Edit:** `dashboard/server.js` (mount route)
- **Create:** `dashboard/routes/events.js`

## Mount route
```js
// dashboard/server.js
app.use('/api/events', require('./routes/events'))
```

## Todo
- [ ] Append schema vào `shared/db.js`
- [ ] Create `dashboard/routes/events.js` với 10 endpoints
- [ ] Mount route vào `dashboard/server.js`
- [ ] Test bằng curl/Postman: tạo group → tạo event → list → reorder → delete

## Success Criteria
- 10 endpoints trả đúng status code và payload
- Reorder transaction atomic (1 update fail → rollback)
- Pagination response shape `{items, total, page, limit}`
- Delete group → events còn lại có `group_id=NULL`

## Risks
- Schema migration không phá data hiện có (CREATE IF NOT EXISTS đã safe)
- Sort_order collision khi nhiều client cùng reorder → chấp nhận (low contention)
