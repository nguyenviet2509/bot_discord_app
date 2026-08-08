---
name: Dashboard Multi-Guild Switcher
slug: dashboard-multi-guild-switcher
status: pending
created: 2026-06-22
updated: 2026-06-22
phases: 5
blockedBy: []
blocks: []
---

# Plan: Dashboard Multi-Guild Switcher

Cho phép dashboard chuyển giữa các guild bot đã join. DB đã ready, refactor 22 routes + UI switcher + chuyển slash command sang global.

## Context
- Brainstorm: [reports/brainstorm-260622-0925-dashboard-multi-guild-switcher.md](../reports/brainstorm-260622-0925-dashboard-multi-guild-switcher.md)
- Red-team: [reports/red-team-260622-0930-dashboard-multi-guild-switcher.md](../reports/red-team-260622-0930-dashboard-multi-guild-switcher.md)
- Endpoint `/api/servers` sẵn có trả guild list

## Decisions
- API contract: `?guildId=` query param (xóa header `x-guild-id` — YAGNI)
- Default: guild đầu từ `/api/servers`, lưu `localStorage.guildId`
- Slash commands: register **global** + parallel guild-scope cho env.GUILD_ID trong 24h (tránh downtime) → cleanup sau qua script
- Pre-warm cache fail → server vẫn listen, fail-open + log warning
- env GUILD_ID giữ làm fallback BE (primary guild default)
- Auth: 1 admin DASHBOARD_SECRET
- Standalone HTML pages: dùng shared helper `/js/guild-context.js`
- `process.env.GUILD_ID` giữ làm fallback BE
- Rollback: commit per phase, dễ revert

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 0 | **Safety prep**: backup DB, feature branch, override auto-push | pending | XS | [phase-00-safety-prep.md](phase-00-safety-prep.md) |
| 1 | Backend guild context + 22 routes + parallel slash commands | pending | M | [phase-01-backend-guild-context.md](phase-01-backend-guild-context.md) |
| 2 | Frontend SPA switcher + apiFetch wrapper | pending | M | [phase-02-frontend-spa-switcher.md](phase-02-frontend-spa-switcher.md) |
| 3 | Standalone HTML pages shared helper | pending | S | [phase-03-standalone-pages-helper.md](phase-03-standalone-pages-helper.md) |
| 4 | Verify multi-guild end-to-end + bot worker check (PROD) | pending | S | [phase-04-verify-and-test.md](phase-04-verify-and-test.md) |

## Success Criteria
- Switch guild trong UI → mọi tab (SPA + standalone) load đúng data
- `grep "process.env.GUILD_ID" dashboard/routes/` = 0
- Slash commands xuất hiện trong mọi guild bot join
- Bot guild lạ truy cập → 403
- Reload giữ guild đã chọn
- Logout clear localStorage.guildId
- 5 setInterval bot workers verify đa guild

## Risks
- Sót route refactor → CI grep check final
- Standalone page có fetch không qua helper → audit kỹ
- Discord global command có 1h propagation delay (chấp nhận)

## Commit Strategy
**OVERRIDE auto-push rule cho plan này** — local-first, không push tới remote tới khi verify.

- Phase 0: backup + branch + rollback hash (no commit)
- Phase 1: commit BE refactor (LOCAL ONLY, không push)
- Phase 2: commit FE SPA (LOCAL ONLY)
- Phase 3: commit standalone helper (LOCAL ONLY)
- Local smoke test guild A sau từng phase
- Sau khi 1-3 OK: `git push origin feature/multi-guild-switcher` → PR → merge master off-hours
- Phase 4: chạy sau khi prod đã deploy + smoke test pass

## Smoke Test Checklist (post-deploy guild A)
- [ ] Dashboard login OK
- [ ] Tab Tổng quan, Members, Settings, Scheduled Messages load đúng data guild A
- [ ] Bot online Discord guild A
- [ ] `/rank` response OK (qua guild-scope parallel)
- [ ] Railway logs không có error stack
→ 7/8 pass = OK. <7 = `git revert` rollback ngay.

## Rollback Plan
1. `git revert <merge-commit>` → push → Railway redeploy
2. DB không cần restore (không đổi schema)
3. Bot restart ~30s
4. Total recovery: ~3-5 phút

Brainstorm safety: [reports/brainstorm-260622-1008-cook-safety-strategy.md](../reports/brainstorm-260622-1008-cook-safety-strategy.md)
