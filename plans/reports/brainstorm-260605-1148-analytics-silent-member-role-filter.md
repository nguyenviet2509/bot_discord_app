# Brainstorm — Analytics Silent Member Role Filter

**Date:** 2026-06-05 11:48
**Status:** Approved → ready for plan

## Problem

Card "Member chưa chat lần nào" trong trang Analytics hiện liệt kê mọi non-bot member chưa từng chat. User muốn lọc thêm: **có role "Clan GoldenStar"** AND **không có role "Whitelisted member"**. Role IDs đã có sẵn, sẽ paste qua UI.

## Decisions (từ brainstorm)

| Vấn đề | Quyết định |
|---|---|
| Phạm vi filter | Config qua UI (include role + exclude role), không hardcode |
| Thời điểm filter | Scan time — filter trong `scan-silent-members.js`, chỉ lưu user pass filter vào DB |
| Storage config | Thêm 2 cột vào `guild_settings`: `silent_include_role_id`, `silent_exclude_role_id` |
| Vị trí UI | Inline trên card Silent Members (2 dropdown + nút "Lưu & quét lại") |
| Save behavior | Auto re-scan ngay sau khi PUT config |

## Solution Design

### 1. DB (shared/db.js)
- ALTER `guild_settings` ADD COLUMN `silent_include_role_id TEXT`, `silent_exclude_role_id TEXT` (idempotent migration)
- Helpers: `getSilentFilterConfig(guildId)`, `setSilentFilterConfig(guildId, { includeRoleId, excludeRoleId })`

### 2. Scan (shared/scan-silent-members.js)
- Đọc config đầu hàm
- Filter chain mở rộng: `!bot && !chatted && (includeRoleId==null || m.roles.includes(includeRoleId)) && (excludeRoleId==null || !m.roles.includes(excludeRoleId))`
- Field `roles[]` sẵn trong response của `/guilds/:id/members`, không cần fetch thêm

### 3. Routes (dashboard/routes/analytics.js)
- `GET /analytics/silent-filter-config` → trả 2 role ID
- `PUT /analytics/silent-filter-config` → validate, lưu DB, await scan, return config + scan result
- `GET /analytics/guild-roles` → proxy Discord API `/guilds/:id/roles` để UI populate dropdown

### 4. UI (dashboard/public/index.html + js/app.js)
- Trên card Silent Members thêm 2 dropdown (Phải có role / Không có role) + nút "Lưu & quét lại" + nút "Bỏ filter"
- Alpine state: `silentFilter`, `guildRoles`
- Load config + roles khi mount; save = PUT → reload list

## Risks & Mitigations

- **Role bị xoá khỏi Discord** → list rỗng. Validate role ID tồn tại trong `getGuildRoles()` khi PUT, warn nếu không (không hard fail).
- **User spam Save** → multiple scan concurrent. Disable nút Save client-side trong khi pending.
- **Backward compat** → 2 cột nullable + scan guard → daily cron + bot cũ vẫn chạy.

## Success Criteria

- 2 dropdown hiển thị danh sách role guild
- Chọn include + exclude + Save → list update đúng (chỉ member match filter)
- Reload trang → config persist
- Null/null → behavior cũ

## Unresolved

- Có show role badges trên từng row member không? (mặc định: KHÔNG, scope ngoài MVP)
- Daily cron scan dùng filter này luôn — assumed YES (vì lưu ở guild_settings)
