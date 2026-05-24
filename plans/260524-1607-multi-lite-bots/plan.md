---
name: Multi Lite Bots Management
slug: multi-lite-bots
created: 2026-05-24
status: pending
priority: medium
effort: ~10.5h
branch: master
brainstorm: plans/reports/brainstorm-260524-1607-multi-lite-bots.md
blockedBy: []
blocks: []
---

# Multi Lite Bots Management

Quản lý 5-20 "lite bot" cùng server BossBabel — tự custom tên, avatar, custom status text qua dashboard. Lazy start, manual toggle. Approach A: extend monorepo, cùng Node process với BossBabel.

## Goals
- CRUD bot qua dashboard (name, avatar, token, presence, activity)
- Toggle Start/Stop từng bot độc lập
- Đổi runtime (không cần restart process)
- Token encrypted at rest (AES-256-GCM)
- Zero impact lên code/data BossBabel

## Non-Goals (v1)
- Auto-start bot khi process boot
- Command/event handler nghiệp vụ cho lite bot
- Giao tiếp BossBabel ↔ lite bot
- Audit log

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 01 | [DB schema + token crypto](phase-01-db-and-crypto.md) | 1h | pending |
| 02 | [Lite client + manager](phase-02-lite-client-manager.md) | 2.5h | pending |
| 03 | [API routes (CRUD + lifecycle)](phase-03-api-routes.md) | 2h | pending |
| 04 | [Dashboard UI tab](phase-04-dashboard-ui.md) | 3h | pending |
| 05 | [Wire start.js + env](phase-05-wire-start-js.md) | 0.5h | pending |
| 06 | [Manual test + polish](phase-06-manual-test.md) | 1.5h | pending |

## Key Dependencies
- Discord application + token có sẵn cho ít nhất 2 bot (user tạo manual ở Developer Portal trước phase 06)
- `BOT_TOKEN_ENCRYPTION_KEY` 32-byte hex trong `.env`
- discord.js (đã có trong workspace `bot/`)
- sharp (optional, cho resize avatar) — install nếu cần ở phase 03

## Files Modified Summary
**New:**
- `shared/db-managed-bots.js`
- `bots-lite/index.js`, `bots-lite/lite-client.js`, `bots-lite/token-crypto.js`
- `dashboard/src/routes/managed-bots.js`
- `dashboard/public/bots-manager.html`, `dashboard/public/js/bots-manager.js`

**Edited:**
- `start.js` (spawn bots-lite manager)
- `dashboard/src/server.js` (mount route) — file path verify ở phase 03
- `dashboard/public/index.html` (thêm nav item) — verify path ở phase 04
- `.env.example` (thêm `BOT_TOKEN_ENCRYPTION_KEY`)
- `package.json` root nếu cần thêm dep
