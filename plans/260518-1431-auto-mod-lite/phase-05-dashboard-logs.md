# Phase 5 — Dashboard Logs Viewer

**Priority:** P1
**Status:** pending
**Effort:** 1 ngày
**Depends on:** Phase 1, 4

## Overview
Bảng xem log vi phạm với filter (user, rule, action, khoảng thời gian) + phân trang. Admin có thể clear warn của 1 user.

## API endpoints (mở rộng `routes/automod.js`)

| Method | Path | Query | Mô tả |
|---|---|---|---|
| GET | `/api/automod/:guildId/logs` | `user, rule, action, from, to, page, pageSize` | List logs có filter, phân trang |
| GET | `/api/automod/:guildId/warns/:userId` | - | Đếm warn active của 1 user |
| DELETE | `/api/automod/:guildId/warns/:userId` | - | Clear warn (admin reset) |
| GET | `/api/automod/:guildId/stats` | `days=7` | Stats: tổng vi phạm theo rule, top vi phạm user |

## UI section (thêm vào `automod.html` hoặc tab riêng)

```
┌─ Logs ──────────────────────────────────────────────┐
│ Filter: [User ▼] [Rule ▼] [Action ▼] [From][To]     │
│ [Apply] [Reset]                                      │
│                                                      │
│ ┌──────┬─────────┬──────┬────────┬──────────┬─────┐ │
│ │ Time │ User    │ Rule │ Action │ Excerpt  │ Ch  │ │
│ ├──────┼─────────┼──────┼────────┼──────────┼─────┤ │
│ │ ...  │ @abc    │ spam │ mute5m │ "spam.." │ #ge │ │
│ └──────┴─────────┴──────┴────────┴──────────┴─────┘ │
│ [Prev] Page 1/12 [Next]                              │
│                                                      │
│ User detail (khi click row):                         │
│ Warn count: 3/24h  [Clear Warns]                     │
└──────────────────────────────────────────────────────┘

┌─ Stats (7 ngày) ────────────────────────────────────┐
│ Vi phạm theo rule:                                   │
│ ▓▓▓▓▓▓▓▓▓ anti-spam     45                          │
│ ▓▓▓▓▓ anti-invite       23                           │
│ ▓▓▓ bad-word            12                           │
│                                                      │
│ Top user vi phạm:                                    │
│ 1. @userA — 8 vi phạm                                │
│ 2. @userB — 5 vi phạm                                │
└──────────────────────────────────────────────────────┘
```

## Implementation steps
1. Thêm `GET /logs` + `GET /warns` + `DELETE /warns` + `GET /stats` vào `routes/automod.js`.
2. UI: thêm section Logs + Stats trong `automod.html` (hoặc tách `automod-logs.html` nếu file quá dài).
3. Filter form → query string → fetch API.
4. Pagination client-side (page + pageSize=20).
5. Click row → expand detail (warn count + clear button).
6. Stats: 1 query GROUP BY rule + 1 query GROUP BY user_id LIMIT 10.

## Files
- **Modify:**
  - `dashboard/routes/automod.js` (thêm 4 endpoint)
  - `dashboard/public/automod.html` (thêm section logs + stats)

**Quyết định:** Gộp vào 1 file `automod.html` thay vì tách → đơn giản UX, ít file. Nếu HTML > 600 dòng thì tách JS ra `public/js/automod.js`.

## Todo
- [ ] 4 endpoint logs/warns/stats
- [ ] UI logs table + filter + pagination
- [ ] UI stats charts (ASCII bar đơn giản, không cần chart lib)
- [ ] Clear warn button + confirm dialog
- [ ] Test với 100+ log rows

## Success criteria
- Filter chính xác (combo user + rule + action)
- Pagination smooth (page change < 200ms)
- Clear warns → DB row biến mất, action ladder reset
- Stats query < 100ms (cần index ở phase 1)

## Risks
- **Performance khi log nhiều (>10k rows):** Index `(guild_id, created_at)` đã có, LIMIT/OFFSET OK đến 100k
- **XSS từ message_excerpt:** Escape HTML khi render
- **User_id không có username:** JOIN với bảng `users` nếu có, hoặc fetch Discord API + cache
