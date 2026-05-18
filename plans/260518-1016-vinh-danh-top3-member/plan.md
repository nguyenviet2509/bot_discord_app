---
name: Vinh Danh Top 3 Member
slug: vinh-danh-top3-member
status: pending
created: 2026-05-18
branch: master
mode: auto
brainstorm: plans/reports/brainstorm-260518-0928-vinh-danh-top3.md
blockedBy: []
blocks: []
---

# Vinh Danh Top 3 Member — Plan Overview

Slash command `/vinhdanh` cho admin gửi embed Champion Spotlight vinh danh Top 3 contributor (Mock 4). Dashboard cấu hình role được phép, preview embed, xem lịch sử.

**Source:** [brainstorm-260518-0928-vinh-danh-top3.md](../reports/brainstorm-260518-0928-vinh-danh-top3.md)
**Mock JSON:** [honor-mocks-discord.md](../visuals/honor-mocks-discord.md) (Mock 4 Champion Spotlight đã chỉnh)

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | Database schema + CRUD | pending | [phase-01-database.md](phase-01-database.md) |
| 2 | Shared embed builder | pending | [phase-02-build-embed-shared.md](phase-02-build-embed-shared.md) |
| 3 | Bot slash command `/vinhdanh` + modal | pending | [phase-03-bot-command-vinh-danh.md](phase-03-bot-command-vinh-danh.md) |
| 4 | Dashboard config (role + channel) | pending | [phase-04-dashboard-config.md](phase-04-dashboard-config.md) |
| 5 | Dashboard preview embed | pending | [phase-05-dashboard-preview.md](phase-05-dashboard-preview.md) |
| 6 | Bot command `/vinhdanh-history` | pending | [phase-06-history-command.md](phase-06-history-command.md) |
| 7 | Testing + deploy commands | pending | [phase-07-test-deploy.md](phase-07-test-deploy.md) |

## Key dependencies
- Phase 2 cần Phase 1 (CRUD tồn tại)
- Phase 3, 5 dùng output Phase 2 (shared builder)
- Phase 6 dùng Phase 1
- Phase 7 sau tất cả

## Files mới (10)
- `shared/db-honor.js`
- `shared/build-honor-embed.js`
- `bot/src/commands/vinh-danh.js`
- `bot/src/commands/vinh-danh-history.js`
- `bot/src/services/honor-service.js`
- `bot/src/events/honor-modal-submit.js` (hoặc handler trong interaction-create)
- `dashboard/routes/honor.js`
- `dashboard/public/honor-config.html`
- `dashboard/public/honor-preview.html`
- `dashboard/public/js/honor-config.js`

## Files modify (4)
- `shared/db.js` — thêm 2 bảng vào `initDb()`
- `bot/src/index.js` — đảm bảo modal handler được route
- `dashboard/server.js` — mount route `/api/honor`
- `dashboard/public/index.html` — link tới `honor-config.html`

## Success criteria
- Admin có role cấp quyền → `/vinhdanh` → modal → submit → embed Champion Spotlight xuất hiện trong <2s
- Mention 3 user, react 🎉 👏 tự động
- Lưu vào `honor_history`
- Non-authorized → "permission denied"
- Dashboard preview render giống Discord
- `/vinhdanh-history` liệt kê 10 lần gần nhất
