# Phase 1 — DB Schema + db-automod.js

**Priority:** P0 (blocker)
**Status:** pending
**Effort:** 1 ngày

## Context
- Brainstorm: [../reports/brainstorm-260518-1431-auto-mod-lite.md](../reports/brainstorm-260518-1431-auto-mod-lite.md)
- DB layer hiện tại: `shared/db.js` (better-sqlite3)
- Pattern tham khảo: `shared/db-honor.js`, `shared/db-mini-game.js`, `shared/db-posts.js`

## Overview
Tạo 4 bảng SQLite mới + module CRUD `shared/db-automod.js` tách riêng theo pattern hiện có. Khởi tạo schema khi load db.

## Requirements
- 4 bảng: `automod_config`, `automod_whitelist`, `automod_warns`, `automod_logs`
- CRUD helpers per-guild
- Migration idempotent (CREATE IF NOT EXISTS)
- Index hợp lý cho query nóng (warns by user, logs by guild + created_at)

## Schema

```sql
CREATE TABLE IF NOT EXISTS automod_config (
  guild_id    TEXT NOT NULL,
  rule_name   TEXT NOT NULL,          -- 'anti-spam' | 'anti-invite' | 'bad-word' | 'anti-mass-mention' | 'anti-repeat'
  enabled     INTEGER NOT NULL DEFAULT 0,
  params_json TEXT NOT NULL DEFAULT '{}',
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (guild_id, rule_name)
);

CREATE TABLE IF NOT EXISTS automod_whitelist (
  guild_id TEXT NOT NULL,
  type     TEXT NOT NULL,             -- 'channel' | 'role'
  id       TEXT NOT NULL,
  PRIMARY KEY (guild_id, type, id)
);

CREATE TABLE IF NOT EXISTS automod_warns (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  rule       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_automod_warns_user ON automod_warns(guild_id, user_id, created_at);

CREATE TABLE IF NOT EXISTS automod_logs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id         TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  rule             TEXT NOT NULL,
  action           TEXT NOT NULL,     -- 'delete' | 'mute' | 'kick' | 'warn'
  message_excerpt  TEXT,
  channel_id       TEXT,
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_automod_logs_guild ON automod_logs(guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automod_logs_user ON automod_logs(guild_id, user_id, created_at DESC);
```

## API `shared/db-automod.js`

```js
// Config
getConfig(guildId)                          // → { 'anti-spam': {enabled, params}, ... }
getRuleConfig(guildId, ruleName)            // → { enabled, params }
upsertRuleConfig(guildId, ruleName, enabled, params)

// Whitelist
listWhitelist(guildId)                      // → { channels: [], roles: [] }
addWhitelist(guildId, type, id)
removeWhitelist(guildId, type, id)
isWhitelisted(guildId, channelId, roleIds)  // boolean (hot path)

// Warns
addWarn(guildId, userId, rule)
countActiveWarns(guildId, userId, expirySec) // sau N giây thì reset, mặc định 86400
clearWarns(guildId, userId)                  // admin reset

// Logs
addLog({ guildId, userId, rule, action, messageExcerpt, channelId })
listLogs(guildId, { userId, rule, action, limit, offset })
countLogs(guildId, filter)
```

## Files
- **Create:** `shared/db-automod.js`
- **Modify:** `shared/db.js` (require + init `db-automod.js` migrate ở init)

## Implementation steps
1. Đọc `shared/db.js` + `shared/db-honor.js` để bám sát pattern (export `{init, ...api}`, dùng shared db instance).
2. Viết schema migration trong function `init(db)`.
3. Viết các CRUD helper với prepared statement cache.
4. Thêm `require('./db-automod').init(db)` vào `shared/db.js` ngay sau init các module khác.
5. Test thủ công: chạy `npm run bot` → log không lỗi → kiểm tra bảng tồn tại bằng `sqlite3 database.sqlite ".tables"`.

## Todo
- [ ] Tạo `shared/db-automod.js` với init + schema
- [ ] CRUD config + whitelist
- [ ] CRUD warns (có `countActiveWarns` lọc theo expiry)
- [ ] CRUD logs (có filter + pagination)
- [ ] Tích hợp init vào `shared/db.js`
- [ ] Verify bảng tạo đúng (sqlite3 CLI hoặc dashboard query)

## Success criteria
- Chạy `npm run bot` lần đầu → 4 bảng được tạo, không lỗi
- Lần chạy thứ 2 → migration idempotent, không lỗi
- Test API bằng node REPL: insert/read/delete config OK

## Risks
- **Conflict tên bảng cũ:** Grep `automod_` trước khi tạo
- **better-sqlite3 prepared statement leak:** Cache statement ở module scope, không tạo trong loop hot path
