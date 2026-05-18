# Phase 4 — Dashboard Config API + UI

**Priority:** P1
**Status:** pending
**Effort:** 2 ngày
**Depends on:** Phase 1, 3

## Context
- Dashboard routes có sẵn: `dashboard/routes/moderation.js`, `honor.js` (REST pattern + auth middleware)
- UI có sẵn: `dashboard/public/honor-config.html` (form config pattern tham khảo)

## Overview
REST API `/api/automod/*` + trang HTML `automod.html` để admin bật/tắt rule, chỉnh threshold, quản lý whitelist, cấu hình ladder.

## API endpoints (`dashboard/routes/automod.js`)

| Method | Path | Body / Query | Mô tả |
|---|---|---|---|
| GET | `/api/automod/:guildId/config` | - | Trả về toàn bộ config 5 rule |
| PUT | `/api/automod/:guildId/config/:rule` | `{enabled, params}` | Update 1 rule |
| GET | `/api/automod/:guildId/whitelist` | - | List channel + role |
| POST | `/api/automod/:guildId/whitelist` | `{type, id}` | Add |
| DELETE | `/api/automod/:guildId/whitelist/:type/:id` | - | Remove |
| GET | `/api/automod/:guildId/ladder` | - | Lấy ladder config |
| PUT | `/api/automod/:guildId/ladder` | `{ladder: [...]}` | Update ladder |
| GET | `/api/automod/:guildId/channels` | - | List channels (proxy Discord) cho whitelist UI |
| GET | `/api/automod/:guildId/roles` | - | List roles |

**Auth:** dùng middleware có sẵn (`dashboard/middleware/*` — kiểm tra session admin guild).

**Ladder storage:** Lưu trong `automod_config` với `rule_name='__ladder__'` (special row) hoặc thêm cột `meta`. → **Chọn:** lưu thành row đặc biệt để tránh đổi schema.

## UI `dashboard/public/automod.html`

Layout (tham khảo `honor-config.html`):

```
┌─ Header: Auto-Mod Config — <Guild Name> ─────────────┐
│                                                       │
│ ┌─ Rules ────────────────────────────────────────┐   │
│ │ [✓] Anti-spam      | Max: [5] tin / [5]s       │   │
│ │ [✓] Anti-invite    | (no params)               │   │
│ │ [ ] Bad-word       | Từ cấm: [textarea]        │   │
│ │ [✓] Mass-mention   | Max mention: [5]          │   │
│ │ [✓] Anti-repeat    | Lặp lại: [3] lần          │   │
│ │ [Save Rules]                                    │   │
│ └────────────────────────────────────────────────┘   │
│                                                       │
│ ┌─ Whitelist ────────────────────────────────────┐   │
│ │ Channels: [multi-select dropdown] [+ Add]      │   │
│ │ Roles:    [multi-select dropdown] [+ Add]      │   │
│ │ Current: #general, #admin, @Moderator          │   │
│ └────────────────────────────────────────────────┘   │
│                                                       │
│ ┌─ Action Ladder ────────────────────────────────┐   │
│ │ Vi phạm 1: [Delete + Warn ▼]                   │   │
│ │ Vi phạm 2: [Mute 5 phút ▼]                     │   │
│ │ Vi phạm 3: [Mute 1 giờ ▼]                      │   │
│ │ Vi phạm 4+: [Kick ▼]                           │   │
│ │ Reset sau: [24] giờ                            │   │
│ │ [Save Ladder]                                   │   │
│ └────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘
```

JS thuần (theo pattern `honor-config.html`), không framework.

## Files
- **Create:**
  - `dashboard/routes/automod.js`
  - `dashboard/public/automod.html`
- **Modify:**
  - `dashboard/server.js` (mount `/api/automod`)
  - `dashboard/public/index.html` (thêm link "Auto-Mod" trong menu)

## Implementation steps
1. Đọc `dashboard/routes/moderation.js` + `honor.js` để bám pattern auth + response format.
2. Viết `routes/automod.js` 9 endpoint.
3. Mount router trong `server.js`.
4. Viết `automod.html`:
   - Section Rules: 5 row, mỗi row checkbox + input params động theo rule
   - Section Whitelist: select multiple từ API `/channels` `/roles`
   - Section Ladder: 4 dropdown action + input reset hours
5. Save: PUT từng rule independently (đơn giản, ít lỗi hơn batch).
6. Test manual: bật rule → verify trong DB → vi phạm → action đúng.

## Todo
- [ ] `routes/automod.js` 9 endpoint
- [ ] Mount router
- [ ] `automod.html` 3 section
- [ ] JS frontend: load config, save rule, manage whitelist, save ladder
- [ ] Link vào navigation
- [ ] Test E2E: dashboard → DB → bot apply đúng

## Success criteria
- Toggle rule trên dashboard → bot apply trong < 5 giây (no restart)
- Whitelist hoạt động (admin role không bị check)
- Ladder config được tôn trọng
- UI responsive, validate input client-side (số > 0)

## Risks
- **Bot không reload config khi đổi:** `getConfig()` query DB mỗi message → real-time, không cần reload
- **Bad-word list quá dài làm chậm:** Compile cache + invalidate khi PUT → OK
- **Discord API rate limit khi list channels/roles:** Cache 60s server-side

## Security
- Validate guildId vs session (user phải là admin guild đó)
- Sanitize bad-word input (limit độ dài, escape regex special chars nếu user nhập plain word)
- Rate limit endpoint PUT (express-rate-limit nếu cần)
