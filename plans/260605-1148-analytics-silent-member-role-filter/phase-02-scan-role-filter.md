# Phase 02 — Scan Role Filter Logic

**Status:** pending
**Priority:** high
**Effort:** S
**Depends on:** Phase 01

## Goal

Mở rộng `scanSilentMembers` để apply include/exclude role filter từ config.

## Files

**Modify:**
- `shared/scan-silent-members.js`

## Steps

1. Import `getSilentFilterConfig` từ `./db`:
   ```js
   const { getSilentFilterConfig } = require('./db') // hoặc giữ require db hiện tại + dùng db.getSilentFilterConfig
   ```

2. Đầu hàm `scanSilentMembers(guildId)`, đọc config:
   ```js
   const { include_role_id, exclude_role_id } = db.getSilentFilterConfig(guildId)
   ```

3. Mở rộng filter chain (line 27):
   ```js
   const silent = allMembers
     .filter(m => {
       if (!m.user || m.user.bot) return false
       if (chattedIds.has(m.user.id)) return false
       const roles = m.roles || []
       if (include_role_id && !roles.includes(include_role_id)) return false
       if (exclude_role_id && roles.includes(exclude_role_id)) return false
       return true
     })
     .map(m => ({ /* ... unchanged ... */ }))
   ```

4. Return giữ nguyên shape `{ total, scanned_at }`.

## Checklist

- [ ] Config null/null → behavior cũ (mọi non-bot non-chatted member)
- [ ] Chỉ set include → list = member có role đó
- [ ] Chỉ set exclude → list = member không có role đó
- [ ] Set cả 2 → AND filter đúng
- [ ] Test bằng cách gọi POST `/analytics/silent-members/scan` sau khi seed config

## Risks

- `m.roles` undefined trên 1 số member object? Discord API luôn trả array (rỗng cho user không có role nào) → fallback `|| []` đủ.
- Role thuộc `@everyone` không xuất hiện trong `m.roles` (Discord quy ước) — không ảnh hưởng vì 2 role này custom.
