---
title: "Mini-game ROLL multi-player"
description: "Thêm mini-game ROLL (N người, random unique 1-100) vào module mini-game, có dashboard quản lý lịch sử."
status: pending
priority: P2
branch: "master"
tags: [mini-game, discord, dashboard]
blockedBy: []
blocks: []
created: "2026-05-24T16:51:17.613Z"
createdBy: "ck:plan"
source: skill
---

# Mini-game ROLL multi-player

## Overview

Thêm mini-game ROLL multi-player vào module `bot/src/modules/mini-game`:
- `/roll-start` (admin/mod) tạo session với option max-người + thời hạn
- Embed có nút **Tham gia/Rời khỏi** (toggle), **Bắt đầu roll**, **Hủy**
- Khi chốt: random unique uniform 1-100 (Fisher-Yates + crypto.randomInt), vinh danh top 1 + ranking đầy đủ
- Không cược coin (vui)
- 1 guild = 1 session active
- Dashboard view lịch sử + clear theo ngày / nuke

**Tham chiếu brainstorm:** [plans/reports/brainstorm-260524-2349-roll-mini-game.md](../reports/brainstorm-260524-2349-roll-mini-game.md)

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [DB Schema](./phase-01-db-schema.md) | Pending |
| 2 | [Services Core](./phase-02-services-core.md) | Pending |
| 3 | [Renderer & Handler](./phase-03-renderer-handler.md) | Pending |
| 4 | [Slash Command](./phase-04-slash-command.md) | Pending |
| 5 | [Startup Sweep](./phase-05-startup-sweep.md) | Pending |
| 6 | [Dashboard](./phase-06-dashboard.md) | Pending |
| 7 | [Test & Docs](./phase-07-test-docs.md) | Pending |

## Key Decisions (chốt từ brainstorm)

1. **Pool scale**: thêm cột `score_max INTEGER DEFAULT 100` (forward-compat). Phase 1 clamp 100.
2. **Edit embed spam**: debounce 1s coalesce + bypass khi state change.
3. **Zombie session restart**: startup sweep + re-schedule timer + stuck-rolling guard.
4. **Random**: Fisher-Yates partial từ pool `[1..score_max]` với `crypto.randomInt` (uniform, audit-proof).
5. **State machine**: `open → rolling → finished` hoặc `open → cancelled`. Transition wrap SQLite transaction.

## Dependencies

- Phase 1 → Phase 2 (services cần schema)
- Phase 2 → Phase 3 (renderer cần store)
- Phase 3 → Phase 4 (command cần button handler)
- Phase 4 → Phase 5 (sweep cần lifecycle hoàn chỉnh)
- Phase 5 → Phase 6 (dashboard cần data + state ổn định)
- Phase 6 → Phase 7

## Out of scope

- Cược coin (extend sau bằng escrow pattern như RPS)
- Multiple sessions/guild
- Leaderboard cross-session
- Score range custom qua option lệnh (đã forward-compat sẵn cột)
- Animation rolling
