# Phase 01 — DB Schema + Config Helpers

**Status:** pending
**Priority:** high (foundation)
**Effort:** S

## Goal

Thêm 2 cột vào `guild_settings` để lưu role filter cho silent members + helper read/write.

## Files

**Modify:**
- `shared/db.js`

## Steps

1. Trong block `CREATE TABLE IF NOT EXISTS guild_settings (...)` thêm 2 cột mới:
   ```sql
   silent_include_role_id TEXT,
   silent_exclude_role_id TEXT,
   ```

2. Migration idempotent (vì table có thể đã tồn tại trên DB prod):
   Sau khi run CREATE TABLE, thêm block `ALTER TABLE` wrap try/catch (pattern hiện có trong codebase nếu có, nếu không dùng PRAGMA table_info check). Ví dụ:
   ```js
   try { db.exec(`ALTER TABLE guild_settings ADD COLUMN silent_include_role_id TEXT`) } catch (_) {}
   try { db.exec(`ALTER TABLE guild_settings ADD COLUMN silent_exclude_role_id TEXT`) } catch (_) {}
   ```
   (SQLite throws nếu cột đã tồn tại → catch nuốt OK)

3. Thêm 2 helper functions:
   ```js
   function getSilentFilterConfig(guildId) {
     const row = getDb()
       .prepare('SELECT silent_include_role_id, silent_exclude_role_id FROM guild_settings WHERE guild_id = ?')
       .get(guildId)
     return {
       include_role_id: row?.silent_include_role_id || null,
       exclude_role_id: row?.silent_exclude_role_id || null,
     }
   }

   function setSilentFilterConfig(guildId, { includeRoleId, excludeRoleId }) {
     getDb().prepare(`
       INSERT INTO guild_settings (guild_id, silent_include_role_id, silent_exclude_role_id, updated_at)
       VALUES (?, ?, ?, unixepoch())
       ON CONFLICT(guild_id) DO UPDATE SET
         silent_include_role_id = excluded.silent_include_role_id,
         silent_exclude_role_id = excluded.silent_exclude_role_id,
         updated_at = unixepoch()
     `).run(guildId, includeRoleId || null, excludeRoleId || null)
   }
   ```

4. Export trong `module.exports`: `getSilentFilterConfig`, `setSilentFilterConfig`.

## Checklist

- [ ] CREATE TABLE đã có 2 cột (cho fresh DB)
- [ ] ALTER TABLE idempotent cho DB cũ
- [ ] Helper get/set hoạt động đúng (null khi chưa set)
- [ ] Export đầy đủ
- [ ] `node -e "require('./shared/db')"` chạy không lỗi

## Risks

- Quên export → route phase 03 sẽ fail. Test bằng require trong node REPL.
