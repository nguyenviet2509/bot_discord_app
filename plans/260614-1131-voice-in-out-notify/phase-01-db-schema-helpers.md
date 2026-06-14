---
phase: 1
title: DB schema + helpers
status: completed
priority: P1
effort: 30m
dependencies: []
---

# Phase 1: DB schema + helpers

## Overview

Thêm bảng `voice_log_settings` + 2 helper (`getVoiceLogSettings`, `upsertVoiceLogSettings`) vào `shared/db.js`. Là dependency của tất cả phase sau.

## Requirements

**Functional:**
- 1 row per guild_id (PRIMARY KEY)
- Lưu: enabled, notify_channel_id, watched_channels (JSON array), join_template, leave_template
- `getVoiceLogSettings(guild_id)` → row hoặc default object (khi chưa có)
- `upsertVoiceLogSettings({guild_id, enabled, notify_channel_id, watched_channels, join_template, leave_template})` → INSERT OR REPLACE

**Non-functional:**
- Idempotent migration (CREATE TABLE IF NOT EXISTS)
- Không phá schema cũ

## Architecture

```sql
CREATE TABLE IF NOT EXISTS voice_log_settings (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  notify_channel_id TEXT,
  watched_channels TEXT NOT NULL DEFAULT '[]',
  join_template TEXT NOT NULL DEFAULT '🔊 {user} vừa vào **{channel}** lúc {time}',
  leave_template TEXT NOT NULL DEFAULT '👋 {username} đã rời **{channel}** lúc {time}',
  updated_at INTEGER DEFAULT (unixepoch())
);
```

`watched_channels` lưu JSON `["123","456"]`. Parse/stringify ở helper layer để các caller chỉ thao tác array.

## Related Code Files

- Modify: `shared/db.js`

## Implementation Steps

1. Trong `initDb()` (sau các `CREATE TABLE` hiện có), thêm SQL `CREATE TABLE IF NOT EXISTS voice_log_settings (...)` với schema trên.
2. Thêm 2 hàm export:
   ```js
   function getVoiceLogSettings(guildId) {
     const row = getDb().prepare('SELECT * FROM voice_log_settings WHERE guild_id = ?').get(guildId)
     if (!row) return {
       guild_id: guildId, enabled: 0, notify_channel_id: null,
       watched_channels: [],
       join_template: '🔊 {user} vừa vào **{channel}** lúc {time}',
       leave_template: '👋 {username} đã rời **{channel}** lúc {time}',
     }
     return { ...row, watched_channels: safeParseJsonArray(row.watched_channels) }
   }

   function upsertVoiceLogSettings({ guild_id, enabled, notify_channel_id, watched_channels, join_template, leave_template }) {
     getDb().prepare(`
       INSERT INTO voice_log_settings (guild_id, enabled, notify_channel_id, watched_channels, join_template, leave_template, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, unixepoch())
       ON CONFLICT(guild_id) DO UPDATE SET
         enabled = excluded.enabled,
         notify_channel_id = excluded.notify_channel_id,
         watched_channels = excluded.watched_channels,
         join_template = excluded.join_template,
         leave_template = excluded.leave_template,
         updated_at = unixepoch()
     `).run(guild_id, enabled ? 1 : 0, notify_channel_id || null, JSON.stringify(Array.isArray(watched_channels) ? watched_channels : []), join_template, leave_template)
   }
   ```
3. `safeParseJsonArray(str)`: try/catch JSON.parse, fallback `[]`. Có thể inline hoặc dùng helper sẵn có (kiểm tra `shared/db.js` xem đã có chưa).
4. Export 2 hàm trong `module.exports`.
5. Chạy `node bot/src/index.js` thử 5s để verify migration không lỗi (Ctrl+C ngay sau dòng `[DB] Database initialized`).

## Success Criteria

- [ ] Bảng `voice_log_settings` được tạo khi `initDb()` chạy lần đầu
- [ ] `getVoiceLogSettings('xxx')` trả default object khi guild chưa có row
- [ ] `upsertVoiceLogSettings({...})` lưu + đọc lại đúng (kiểm bằng `sqlite3 database.sqlite "SELECT * FROM voice_log_settings"`)
- [ ] Không lỗi compile, không lỗi runtime khi bot khởi động

## Risk Assessment

- **Risk**: JSON parse lỗi nếu cột bị manual edit → mitigated bởi try/catch fallback `[]`
- **Risk**: Naming conflict với hàm cũ → grep `getVoiceLogSettings` trước khi thêm (kỳ vọng 0 hit)
