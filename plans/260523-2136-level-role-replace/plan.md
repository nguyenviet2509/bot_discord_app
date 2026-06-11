---
name: Level-up Role Replace (Simplified)
slug: 260523-2136-level-role-replace
created: 2026-05-23
status: pending
mode: fast
blockedBy: []
blocks: []
---

# Level-up Role Replace — Simplified Plan

## Context
- Brainstorm v2: [plans/reports/brainstorm-260523-2136-level-role-replace-v2.md](../reports/brainstorm-260523-2136-level-role-replace-v2.md)
- File duy nhất: [bot/src/services/level-service.js](../../bot/src/services/level-service.js)

## Goal
Khi user lên cấp mới, chỉ giữ 1 role-reward có `level_required` cao nhất ≤ newLevel. Các role-reward khác mà user đang giữ → tự bỏ.

## Phases

| # | Phase | File | Status |
|---|-------|------|--------|
| 01 | Sửa `handleLevelUp` logic role | [phase-01-update-handle-level-up.md](phase-01-update-handle-level-up.md) | pending |

## Out of Scope
- Toggle mode (không làm)
- DB migration (không làm)
- Dashboard UI (không làm)
- `/set-level` integration (không làm)
- Backfill (admin tự xử)

## Success Criteria
User chat lên level X → role-reward hiện có = đúng 1 role-reward có level_required cao nhất ≤ X (hoặc 0 nếu không có reward eligible). Các role-reward khác bị remove.
