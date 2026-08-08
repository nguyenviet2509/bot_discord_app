# Phase 1 — DB schema + helpers

**Status:** pending
**Effort:** 0.5 ngày
**Priority:** P0 (blocking các phase sau)

## Overview

Tạo `shared/db-word-filter.js` với 1 bảng config per-guild. Init schema từ `shared/db.js` (giống pattern `db-automod.js`).

## Schema

```sql
CREATE TABLE IF NOT EXISTS word_filter_config (
  guild_id   TEXT PRIMARY KEY,
  enabled    INTEGER NOT NULL DEFAULT 0,
  words_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Lý do **không** dùng `automod_config` (rule-based, mỗi rule 1 row): word-filter là module riêng, có toggle + 1 list từ → 1 bảng phẳng đơn giản hơn (KISS).

## API

```js
// shared/db-word-filter.js
exports.initWordFilterSchema = (db) => { db.exec(SCHEMA_SQL) }

exports.getConfig = (guildId) => ({ enabled: bool, words: string[] })
// Trả default { enabled: false, words: [] } nếu không có row.

exports.setConfig = (guildId, { enabled, words }) => void
// UPSERT. Validate: words là array, mỗi từ trim, length 1..100, dedupe case-insensitive.

exports.isEnabled = (guildId) => boolean
// Optimized cho hot path (handler check trước khi parse JSON).
```

## Related files

**Create:**
- `shared/db-word-filter.js`

**Modify:**
- `shared/db.js` — gọi `initWordFilterSchema(db)` trong init sequence (xem cách `db-automod` được gọi).

## Implementation steps

1. Tạo `shared/db-word-filter.js` theo pattern `shared/db-automod.js`:
   - `SCHEMA_SQL` const
   - `initWordFilterSchema(database)` export
   - Lazy resolver `db()` để tránh circular require
   - `getConfig`, `setConfig`, `isEnabled` exports
2. Mở `shared/db.js`, tìm chỗ init schema cho `db-automod` → thêm dòng tương tự cho `db-word-filter`.
3. Test thủ công: chạy bot, check SQLite có bảng `word_filter_config`:
   ```bash
   sqlite3 <db-path> ".schema word_filter_config"
   ```
4. Test setConfig/getConfig qua REPL hoặc throwaway script.

## Todo

- [ ] Tạo `shared/db-word-filter.js` với schema + 3 hàm export
- [ ] Wire init vào `shared/db.js`
- [ ] Validate dedupe + trim trong `setConfig`
- [ ] Smoke test: insert → read → update → read

## Success criteria

- Bảng `word_filter_config` tồn tại sau khi bot khởi động
- `getConfig` trả default khi guild chưa cấu hình
- `setConfig` dedupe case-insensitive ("ABC" + "abc" → chỉ 1 entry)

## Risks

- Schema migration trên DB production: bảng mới `CREATE IF NOT EXISTS` → an toàn, không break gì.

## Next

→ Phase 2: viết module handler dùng `getConfig` / `isEnabled`.
