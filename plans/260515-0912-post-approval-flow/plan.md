---
name: post-approval-flow
status: implemented
created: 2026-05-15
completed: 2026-05-15
blockedBy: []
blocks: []
brainstorm: plans/reports/brainstorm-260515-0912-post-approval-flow.md
---

# Post Approval Flow — Implementation Plan

## Overview
Discord bot feature: member submit bài qua `/post` → vào queue `#review` (text channel) → admin click button duyệt → bot tạo forum thread trong `#public`. Hỗ trợ edit (re-review) + delete. Audit đầy đủ trong DB.

## Tech Context
- discord.js v14, better-sqlite3, Node.js
- Files mới: 7 (commands x4, event handler x1, service x1, util x1)
- Files sửa: 2 (`shared/db.js`, `bot/src/index.js`)

## Phases

| # | Phase | File | Status |
|---|---|---|---|
| 01 | DB schema + settings extension | [phase-01-db-schema.md](phase-01-db-schema.md) | ✅ done |
| 02 | Admin `/post-setup` command | [phase-02-post-setup.md](phase-02-post-setup.md) | ✅ done |
| 03 | `/post` create flow + embed util | [phase-03-post-create.md](phase-03-post-create.md) | ✅ done |
| 04 | Interaction handler refactor + approval buttons | [phase-04-approval-flow.md](phase-04-approval-flow.md) | ✅ done |
| 05 | `/post-edit` re-review flow | [phase-05-post-edit.md](phase-05-post-edit.md) | ✅ done |
| 06 | `/post-delete` ownership + cleanup | [phase-06-post-delete.md](phase-06-post-delete.md) | ✅ done |
| 07 | Integration test + docs update | [phase-07-test-docs.md](phase-07-test-docs.md) | ✅ done |

## Key Dependencies
- Brainstorm decisions: [brainstorm report](../reports/brainstorm-260515-0912-post-approval-flow.md)
- Existing: `shared/db.js`, `bot/src/index.js`, `getSettings()`, `memberHasAccess()`
- Discord permissions required: bot phải có `ManageThreads`, `CreatePublicThreads`, `SendMessages` trong cả 2 channel

## Success Criteria
- Toàn bộ flow chạy end-to-end với data thật (no mock)
- DB ghi đủ audit fields
- Idempotent button (double-click không tạo duplicate)
- Edit bài approved → thread cũ xóa, vào lại pending
- `/post-delete` xóa sạch thread + đánh dấu DB

## Build Order
Strict sequential: 01 → 02 → 03 → 04 → 05 → 06 → 07
(Phase 04 phụ thuộc Phase 03 vì cần message_id từ #review)
