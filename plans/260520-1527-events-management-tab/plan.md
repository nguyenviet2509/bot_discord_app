---
status: implemented
created: 2026-05-20
slug: events-management-tab
blockedBy: []
blocks: []
---

# Plan: Tab "Quản lý Events"

Khung quản lý tổng cho custom bot events (giveaway/raffle/trivia...) — chưa implement logic chạy event, chỉ build CRUD + group + drag-drop + phân trang.

## Scope
- Per-server (filter `guild_id`)
- Folder-style group (1 event ↔ 1 group, hoặc NULL = "Chưa phân nhóm")
- Drag-drop: event cross-group, reorder event trong group, reorder groups
- Phân trang events trong từng group (limit 10)

## Tech Stack
- DB: SQLite (extend `shared/db.js`)
- Backend: Express route mới `dashboard/routes/events.js`
- Frontend: Alpine.js + SortableJS (CDN)

## Phases

| # | File | Status | Mô tả |
|---|------|--------|------|
| 01 | [phase-01-db-schema-and-backend.md](phase-01-db-schema-and-backend.md) | implemented | Schema 2 bảng + REST routes |
| 02 | [phase-02-tab-skeleton-and-groups.md](phase-02-tab-skeleton-and-groups.md) | implemented | Tab UI + group CRUD + reorder groups |
| 03 | [phase-03-events-crud-pagination.md](phase-03-events-crud-pagination.md) | implemented | Event CRUD + phân trang theo group |
| 04 | [phase-04-drag-drop-events.md](phase-04-drag-drop-events.md) | implemented | SortableJS cross-group + reorder events |

## Dependencies
- SortableJS CDN: `https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js`
- Reuse pattern `scheduled_message_groups` + `scheduled_messages`

## Out of Scope
- Logic chạy event (giveaway picker, trivia engine...) — sẽ làm sau cho từng `type`
- Bulk action, search, import/export
- Soft delete / trash bin
- Nested groups, many-to-many

## Open Questions
1. Xóa group có events → confirm dialog "Move events sang Chưa phân nhóm" (default Y)
2. Hard delete events khi xóa (đã chốt) — không trash bin
