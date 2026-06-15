---
title: Worldcup Match Notifications (MVP)
status: completed
created: 2026-06-15
completed: 2026-06-15
brainstorm: plans/reports/brainstorm-260615-1001-worldcup-match-notifications.md
blockedBy: []
blocks: []
related: [260605-1628-wc-2026-minigames]
---

# Worldcup Match Notifications

Module mới `worldcup` gửi tin nhắn embed thông báo trận đấu Worldcup sắp diễn ra trước kick-off N phút (configurable per-guild). Lịch nhập tay qua dashboard, global, owner gating bằng role.

## Goals

- Bot owner (role được set) CRUD lịch trận đấu qua dashboard.
- Mỗi guild tự config 1 channel, N phút trước trận, optional role ping.
- Scheduler tự động gửi embed đúng thời điểm, idempotent, postpone-safe.

## Tech Stack

- Module mới: `bot/src/modules/worldcup/` (modular pattern)
- DB: SQLite (extend `shared/db.js`) — 4 bảng mới
- Dashboard: 2 tab mới (owner + per-guild)
- Cron: `setInterval` 60s trong `register.js` (KISS, không thêm dep)

## Related plans

- `260605-1628-wc-2026-minigames` — Pick'em/Bracket mini game cho WC. Dùng module + DB riêng (`wc-pickem`), không overlap. **Lưu ý:** nếu sau này muốn share schedule data có thể refactor; MVP tách riêng.

## Phases

| # | Phase | Effort | Status |
|---|---|---|---|
| 01 | DB schema + seed 32 teams (`shared/db-worldcup.js`) | S | ✅ |
| 02 | Notifier worker hook in `bot/src/index.js` | S | ✅ |
| 03 | Dashboard CRUD matches + teams (route + UI) | M | ✅ |
| 04 | Per-guild config UI + API (gộp chung worldcup.html) | S | ✅ |
| 05 | Embed renderer + scheduler 60s tick + catch-up + idempotency | M | ✅ |
| 06 | Smoke test (schema, CRUD, payload, idempotency, cascade) | S | ✅ |

## Files delivered

**Backend:**
- `shared/db-worldcup.js` — schema + helpers (teams, matches, guild config, notification log)
- `shared/db.js` — init hook
- `bot/src/utils/worldcup-notifier.js` — tick + catch-up + embed renderer
- `bot/src/index.js` — start worker on ready

**Dashboard:**
- `dashboard/routes/worldcup.js` — REST API (teams, matches, config, preview, test-send)
- `dashboard/server.js` — mount `/api/worldcup`
- `dashboard/public/worldcup.html` — standalone page
- `dashboard/public/js/worldcup.js` — Alpine.js state
- `dashboard/public/index.html` — sidebar nav-item + iframe tab

## Simplifications vs original plan

- Single-admin dashboard (JWT) → bỏ owner role gating layer.
- Single GUILD_ID env → guild config dùng env trực tiếp (DB vẫn key by guild_id để future-proof).
- Không tạo module `bot/src/modules/worldcup/` riêng — dùng utility `worldcup-notifier.js` pattern (như daily-cron) vì không cần manifest/per-guild toggle.
- Gộp owner CRUD + guild config vào 1 standalone page thay vì 2 tab.

## Key Decisions (từ brainstorm)

- Nguồn dữ liệu: nhập tay qua dashboard (không API ngoài).
- Lịch trận đấu **global**, owner CRUD; per-guild chỉ config nhận thông báo.
- Notify timing: **trước trận N phút** (configurable, default 30).
- Format: embed có giờ local theo timezone guild + optional role ping (KHÔNG dùng flag emoji, KHÔNG hiển thị sân vận động).
- Permission: bot owner xác định bằng **role** do user set (lưu trong app_settings).
- Out of scope MVP: lưu tỉ số, filter theo đội, nhiều rule per-guild, import API.

## Success Criteria

- Tạo trận cách `now + 30m`, guild N=30 → đúng phút thứ 30 trước trận gửi 1 tin embed có đủ team + giờ local.
- Restart bot ở phút 29 → không gửi trùng (idempotent qua log).
- Đổi kick-off lùi 1h → notification cũ không gửi, gửi lại đúng N phút trước giờ mới.
- Disable guild config → không gửi.

## Risks

- Bot restart trùng phút gửi → giải bằng catch-up window `[now-2m, now+2m]` khi tick đầu sau ready.
- Timezone/DST → lưu UTC, render qua `Intl.DateTimeFormat`.
- Owner gating bypass → verify role server-side mọi request.
