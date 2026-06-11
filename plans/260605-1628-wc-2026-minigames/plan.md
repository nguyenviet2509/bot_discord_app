---
title: Mini Game World Cup 2026 (Pick'em + Bracket)
status: pending
created: 2026-06-05
launch_p1: 2026-06-10
launch_p2: 2026-06-27
brainstorm: plans/reports/brainstorm-260605-1628-wc-2026-minigames.md
blockedBy: []
blocks: []
---

# Mini Game World Cup 2026

Tích hợp 2 mini game cho mùa WC 2026 (11/6 → 19/7). Reuse module pattern hiện có. Reward = config dashboard (text + ảnh), không động coin economy.

## Goals

- Phase 1 launch trước **2026-06-11** (kickoff): Daily Pick'em 1X2
- Phase 2 launch trước **2026-06-28** (R16): Bracket Challenge
- Per-guild leaderboard, điểm tách khỏi coin/level

## Tech Stack

- Module mới: `bot/src/modules/wc-pickem/`
- DB: SQLite (extend `shared/db.js`), helpers `shared/db-wc-pickem.js`
- API: [football-data.org](https://www.football-data.org) free tier (10 req/min)
- Dashboard: tab "WC 2026" + form bracket riêng (token auth)
- Cron: `node-cron` (kiểm tra đã có chưa, nếu chưa add)

## Phases

| # | Phase | Effort | Deadline | File |
|---|---|---|---|---|
| 01 | DB schema + helpers `db-wc-pickem.js` | XS | 06-06 | [phase-01](phase-01-db-schema.md) |
| 02 | football-data.org client + match cache + cron poll | S | 06-07 | [phase-02](phase-02-football-data-client.md) |
| 03 | Module skeleton `wc-pickem` + manifest + register | XS | 06-07 | [phase-03](phase-03-module-skeleton.md) |
| 04 | Daily Pick'em — scheduler + button + scorer | M | 06-09 | [phase-04](phase-04-pickem-flow.md) |
| 05 | Dashboard tab WC: settings + prizes config + leaderboard | M | 06-10 | [phase-05](phase-05-dashboard-tab.md) |
| 06 | Slash commands `/wc-leaderboard` `/wc-prizes` | XS | 06-10 | [phase-06](phase-06-slash-commands.md) |
| 🚀 | **LAUNCH Phase 1** (Pick'em) | | **06-10** | |
| 07 | Bracket form dashboard + token auth + submit API | M | 06-22 | [phase-07](phase-07-bracket-form.md) |
| 08 | Bracket scorer + `/wc-bracket` DM link command | S | 06-25 | [phase-08](phase-08-bracket-scorer.md) |
| 🚀 | **LAUNCH Phase 2** (Bracket) | | **06-27** | |
| 09 | Polish: admin override result, DM reminder, leaderboard pagination | S | optional | [phase-09](phase-09-polish.md) |

## Key Decisions (từ brainstorm)

- API key chưa có → Phase 2 có task đăng ký football-data.org
- Sửa pick được tới kickoff (override silent)
- KO result = chung cuộc sau penalty
- 1 channel/guild duy nhất cho Pick'em embed
- Per-guild leaderboard, không cross-guild
- Bracket UI: dashboard web, Discord chỉ DM link token-auth (TTL 30 phút)

## Dependencies

- Đăng ký account football-data.org (Phase 2)
- Channel ID admin set qua dashboard trước khi bật
- Module phải được enable per-guild qua dashboard (defaultEnabled: false)

## Out of Scope (YAGNI)

- Trivia game (đề xuất ban đầu, bỏ)
- Score predictor (đoán tỷ số chính xác)
- Live in-game polls
- Goal scorer bingo / player stats
- Multi-guild leaderboard
- Tự động trao thưởng (admin trao tay)
