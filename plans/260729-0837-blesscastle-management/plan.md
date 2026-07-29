---
name: BlessCastle Management
slug: blesscastle-management
status: completed
created: 2026-07-29
updated: 2026-07-29
blockedBy: []
blocks: []
---

# Plan: BlessCastle Management

Multi-guild event điểm danh + tích lũy sao đổi quà. Voice auto-track khung Fri 20-21h ≥30', manual attendance Mon → Fri 19h, chốt tuần Fri 21h → +1 star, 3⭐ → đổi quà (reset 0), soft-delete 7 ngày khi leave.

**Brainstorm report:** [plans/reports/brainstorm-260729-0837-blesscastle-management.md](../reports/brainstorm-260729-0837-blesscastle-management.md)

## Phases

| # | File | Status | Priority |
|---|------|--------|----------|
| 01 | [phase-01-db-schema.md](phase-01-db-schema.md) | completed | high |
| 02 | [phase-02-voice-tracker-cron.md](phase-02-voice-tracker-cron.md) | completed | high |
| 03 | [phase-03-discord-commands-handlers.md](phase-03-discord-commands-handlers.md) | completed | high |
| 04 | [phase-04-dashboard-api.md](phase-04-dashboard-api.md) | completed | high |
| 05 | [phase-05-dashboard-ui.md](phase-05-dashboard-ui.md) | completed | high |
| 06 | [phase-06-integration-test.md](phase-06-integration-test.md) | completed | medium |

## Key Dependencies

- `shared/db.js` (SQLite better-sqlite3) — thêm init call
- `bot/src/events/voice-state-update.js` — hook thêm listener BlessCastle
- `bot/src/commands/` — register slash commands mới
- `bot/index.js` — register cron
- `dashboard/public/index.html` + nav sidebar — thêm tab
- Skills: `dashboard-layout` (BẮT BUỘC khi làm UI)

## Success

Admin config voice channels + tick manual, auto voice tracking Fri 20-21h hoạt động, chốt Fri 21h +1⭐, redeem reset về 0 + log, `/bc-stars` + `/bc-leaderboard` OK, soft-delete/restore trong 7 ngày.
