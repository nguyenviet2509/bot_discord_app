---
phase: 1
title: "DB Schema"
status: pending
priority: P1
effort: "1h"
dependencies: []
---

# Phase 1: DB Schema

## Overview

Mở rộng `shared/db-mini-game.js`: thêm 2 bảng `roll_session`, `roll_participant` + helpers CRUD cơ bản.

## Requirements

**Functional:**
- 2 bảng SQLite: `roll_session` (header) + `roll_participant` (detail)
- Index cho query phổ biến: state lookup, listing theo created_at, ranking theo score
- ~~Cột `score_max` forward-compat~~ **BỎ (Validation S1)** — hardcode 100. Khi cần custom range → `ALTER TABLE ADD COLUMN` sau.

**Non-functional:**
- Schema migration idempotent (`CREATE TABLE IF NOT EXISTS`)
- FK `ON DELETE CASCADE` để xóa participants khi xóa session
- Không phá schema cũ (pvp_match, user_coin, coin_tx vẫn nguyên)

## Architecture

```sql
roll_session (
  id, guild_id, channel_id, message_id,
  host_id, max_players, score_max,
  state, expires_at,
  winner_id, winner_score, cancel_reason,
  created_at, finished_at
)
  ├─ idx_roll_state (guild_id, state)
  └─ idx_roll_created (guild_id, created_at DESC)

roll_participant (
  session_id FK → roll_session.id ON DELETE CASCADE,
  user_id,
  score (NULL khi chưa roll),
  joined_at
)
  └─ idx_roll_part_session (session_id, score DESC)
```

## Related Code Files

- **Modify:** [shared/db-mini-game.js](../../shared/db-mini-game.js)
  - Thêm 2 `CREATE TABLE` vào `SCHEMA_SQL`
  - Export helper mới (xem Implementation Steps)

## Implementation Steps

1. Mở `shared/db-mini-game.js`, thêm vào cuối chuỗi `SCHEMA_SQL`:

   ```sql
   CREATE TABLE IF NOT EXISTS roll_session (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     guild_id      TEXT NOT NULL,
     channel_id    TEXT NOT NULL,
     message_id    TEXT,
     host_id       TEXT NOT NULL,
     max_players   INTEGER NOT NULL DEFAULT 100,
     state         TEXT NOT NULL,
     <!-- Updated: Validation Session 1 - bỏ cột score_max (YAGNI) -->
     expires_at    INTEGER NOT NULL,
     winner_id     TEXT,
     winner_score  INTEGER,
     cancel_reason TEXT,
     created_at    INTEGER DEFAULT (unixepoch()),
     finished_at   INTEGER
   );
   CREATE INDEX IF NOT EXISTS idx_roll_state ON roll_session(guild_id, state);
   CREATE INDEX IF NOT EXISTS idx_roll_created ON roll_session(guild_id, created_at DESC);

   CREATE TABLE IF NOT EXISTS roll_participant (
     session_id  INTEGER NOT NULL,
     user_id     TEXT NOT NULL,
     score       INTEGER,
     joined_at   INTEGER DEFAULT (unixepoch()),
     PRIMARY KEY (session_id, user_id),
     FOREIGN KEY (session_id) REFERENCES roll_session(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_roll_part_session ON roll_participant(session_id, score DESC);
   ```

2. Kiểm tra `initMiniGameSchema(database)` đã `database.exec(SCHEMA_SQL)` — schema mới tự áp dụng lúc bot start. Không cần migration riêng.

3. Verify PRAGMA `foreign_keys = ON` được set ở `shared/db.js` (cần thiết để FK CASCADE hoạt động). Nếu chưa → cập nhật.

4. Compile check: chạy `node -e "require('./shared/db-mini-game.js')"` không lỗi syntax.

5. Start bot dev, mở SQLite browser hoặc:
   ```bash
   sqlite3 database.sqlite ".schema roll_session"
   sqlite3 database.sqlite ".schema roll_participant"
   ```
   Confirm 2 bảng đã tạo.

## Success Criteria

- [ ] `database.sqlite` có 2 bảng `roll_session` + `roll_participant` sau khi bot start
- [ ] FK CASCADE hoạt động: xóa session → participants tự xóa
- [ ] Index `idx_roll_state`, `idx_roll_created`, `idx_roll_part_session` tồn tại (`.indexes` confirm)
- [ ] Schema cũ (pvp_match, user_coin, coin_tx) không bị ảnh hưởng

## Red Team Fixes (2026-05-25)

**[Finding 5 — High] Bắt buộc thêm UNIQUE partial index** chống race 2 admin /roll-start:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_roll_one_active
  ON roll_session(guild_id) WHERE state IN ('open','rolling');
```

Phase 2 `createSession` phải `try { INSERT } catch (e if SQLITE_CONSTRAINT_UNIQUE)` → return `{ duplicate: true, existingId }` để Phase 4 reply ephemeral.

## Risk Assessment

| Risk | Severity | Mitigation |
|------|---------|-----------|
| `foreign_keys` chưa enable → CASCADE không chạy | Medium | Verify ở `shared/db.js`, add `PRAGMA foreign_keys = ON` nếu thiếu |
| Cột `score_max` thừa ở phase 1 | Low | Acceptable cost cho forward-compat (xem brainstorm decision 1) |
