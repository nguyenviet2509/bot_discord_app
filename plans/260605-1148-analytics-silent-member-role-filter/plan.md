---
title: Analytics Silent Member Role Filter
slug: analytics-silent-member-role-filter
date: 2026-06-05
status: completed
priority: medium
blockedBy: []
blocks: []
---

# Plan — Analytics Silent Member Role Filter

Lọc card "Member chưa chat lần nào" theo role: include `Clan GoldenStar` AND exclude `Whitelisted member`. Config qua UI (lưu `guild_settings`), apply ở scan time, auto re-scan khi save.

## Context

- Brainstorm: `plans/reports/brainstorm-260605-1148-analytics-silent-member-role-filter.md`
- Files chính:
  - `shared/db.js` (schema + helpers)
  - `shared/scan-silent-members.js` (filter logic)
  - `dashboard/routes/analytics.js` (routes)
  - `dashboard/public/index.html` (UI card)
  - `dashboard/public/js/app.js` (Alpine state)

## Phases

| # | Phase | Status |
|---|---|---|
| 01 | DB schema + config helpers | completed |
| 02 | Scan logic role filter | completed |
| 03 | Routes (config + guild roles) | completed |
| 04 | UI inline filter card | completed |

## Key Dependencies

- Discord API `/guilds/:id/members` đã trả `roles[]` (no extra fetch)
- Discord API `/guilds/:id/roles` cho dropdown
- `BOT_TOKEN` env (đã có)
- Privileged intent `GuildMembers` (đã active vì scan hiện tại work)

## Success Criteria

- Save config → list reload với filter đúng
- Null/null → behavior cũ
- Persist qua reload
- Backward compat: bot/cron không break khi cột mới chưa có data
