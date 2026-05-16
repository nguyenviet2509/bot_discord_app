---
slug: mini-bot-modules
date: 2026-05-16
status: pending
mode: auto
brainstorm: plans/reports/brainstorm-260516-2034-mini-bot-modules.md
blockedBy: []
blocks: []
---

# Plan — Mini-bot Module System + Pilot Mini-Game

## Mục tiêu

Thêm hạ tầng "sub-module" (bot nhỏ) vào `bot/src/modules/`, gate per-guild qua dashboard, pilot module `mini-game` (3 game) + coin economy. KHÔNG đụng commands/events hiện có (level/post/mod giữ nguyên hành vi).

## Tham chiếu

- Brainstorm: [brainstorm-260516-2034-mini-bot-modules.md](../reports/brainstorm-260516-2034-mini-bot-modules.md)
- Code chính: `bot/src/index.js`, `bot/src/events/interaction-create.js`, `shared/db.js`, `dashboard/`

## Phase Overview

| # | Phase | Trạng thái | Ước lượng |
|---|---|---|---|
| 01 | [DB schema + helpers](phase-01-db-schema-helpers.md) | ⏳ pending | S |
| 02 | [Module loader + manifest contract](phase-02-module-loader.md) | ⏳ pending | S |
| 03 | [Gate trong interaction-create](phase-03-interaction-gate.md) | ⏳ pending | XS |
| 04 | [Mini-game PvP module pilot](phase-04-mini-game-module.md) | ⏳ pending | L |
| 05 | [Dashboard API + UI /modules (+ detail panel)](phase-05-dashboard-modules-ui.md) | ⏳ pending | L |
| 06 | [Test E2E + docs sync](phase-06-test-and-docs.md) | ⏳ pending | S |

**Mockup tham chiếu:** [mockup-modules-page.html](mockup-modules-page.html)

## Dependencies

```
01 (DB) ──► 02 (Loader) ──► 03 (Gate) ──► 04 (Mini-game)
                                          │
01 ──────────────────────────────────────┘
02 ──► 05 (Dashboard)
04 ──► 06 (Test)
05 ──► 06
```

## Success criteria

- Thêm folder `modules/<key>/` + manifest → dashboard auto-discovery, không cần sửa loader/UI
- Pilot `mini-game` chạy trên 1 guild test: guess-number / rps / odd-even đều cộng/trừ coin đúng
- Toggle module qua dashboard có hiệu lực ngay (next command bị gate chặn)
- Toàn bộ command cũ (level/post/mod) không đổi hành vi
- Compile sạch (`npm run bot` boot không lỗi)

## Out of scope

- Migration command cũ sang `modules/core/` (để sau khi pilot ổn)
- Coin leaderboard, coin decay
- Hot-reload module khi runtime
- Module re-register slash command khi toggle off (chỉ gate, không ẩn)
