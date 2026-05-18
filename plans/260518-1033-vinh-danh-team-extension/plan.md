---
name: Vinh Danh Team Extension
slug: vinh-danh-team-extension
status: pending
created: 2026-05-18
branch: master
mode: auto
brainstorm: plans/reports/brainstorm-260518-1033-vinh-danh-team-extension.md
extends: plans/260518-1016-vinh-danh-top3-member
blockedBy: []
blocks: []
---

# Vinh Danh Team Extension — Plan Overview

Mở rộng `/vinhdanh` thành 2 subcommand: `ca-nhan` (Top 3 hiện tại) + `team` (1-10 member với Team Roster layout). DB tách bảng riêng. History command UNION cả 2 type.

**Source:** [brainstorm-260518-1033-vinh-danh-team-extension.md](../reports/brainstorm-260518-1033-vinh-danh-team-extension.md)
**Parent plan:** [260518-1016-vinh-danh-top3-member](../260518-1016-vinh-danh-top3-member/plan.md)

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | DB schema + CRUD (honor_team_history) | pending | [phase-01-db-team.md](phase-01-db-team.md) |
| 2 | Team embed builder | pending | [phase-02-team-embed-builder.md](phase-02-team-embed-builder.md) |
| 3 | Refactor /vinhdanh → subcommand + add team | pending | [phase-03-subcommand-team.md](phase-03-subcommand-team.md) |
| 4 | Update history (UNION 2 type) | pending | [phase-04-history-union.md](phase-04-history-union.md) |
| 5 | Dashboard tab Team + preview mode | pending | [phase-05-dashboard-team.md](phase-05-dashboard-team.md) |
| 6 | Testing + deploy | pending | [phase-06-test-deploy.md](phase-06-test-deploy.md) |

## Key dependencies
- Phase 3 cần Phase 1, 2
- Phase 4 cần Phase 1
- Phase 5 độc lập với Phase 3 (chỉ cần Phase 1, 2)
- Phase 6 sau tất cả

## Files mới (1)
- `shared/build-honor-team-embed.js`

## Files modify (7)
- `shared/db.js` — thêm `CREATE TABLE honor_team_history`
- `shared/db-honor.js` — thêm CRUD cho team history
- `bot/src/commands/vinh-danh.js` — restructure thành subcommand (ca-nhan + team), thêm modal handler riêng cho team
- `bot/src/commands/vinh-danh-history.js` — UNION cả 2 type, icon phân biệt
- `bot/src/services/honor-service.js` — thêm `publishHonorTeam` + key pending có suffix type
- `dashboard/routes/honor.js` — thêm endpoint team-history + preview team
- `dashboard/public/honor-config.html` + `js/honor-config.js` — tab "Team" + preview mode switch

## Breaking change
⚠️ `/vinhdanh` cũ → `/vinhdanh ca-nhan` (subcommand). Admin cần biết.

## Success criteria
- `/vinhdanh ca-nhan` hoạt động y hệt `/vinhdanh` cũ (Champion Spotlight)
- `/vinhdanh team` với 1 user → embed 1 cột; với 6-10 user → embed 2 cột
- Modal team: title + team_name + 1 reason chung
- `/vinhdanh-history` liệt kê cả 2 type, icon 👤/👥 phân biệt
- Dashboard có tab "Lịch sử Team" riêng
- Preview dashboard hỗ trợ chọn type
