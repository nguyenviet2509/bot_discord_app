---
name: Dashboard Mobile Responsive
slug: 260523-2215-dashboard-mobile-responsive
created: 2026-05-23
status: pending
mode: fast
blockedBy: []
blocks: []
---

# Dashboard Mobile Responsive — Plan

## Context
- Brainstorm: [plans/reports/brainstorm-260523-2215-dashboard-mobile-responsive.md](../reports/brainstorm-260523-2215-dashboard-mobile-responsive.md)
- Target: toàn bộ `dashboard/public/` responsive ở breakpoint `< 768px`
- Pattern: hamburger drawer + sticky header stack + grid 1-col + padding shrink + table overflow

## Phases

| # | Phase | File | Status |
|---|-------|------|--------|
| 01 | Sidebar drawer + hamburger + main margin | [phase-01-sidebar-drawer.md](phase-01-sidebar-drawer.md) | pending |
| 02 | Content responsive trong 16 tab của index.html | [phase-02-index-content-responsive.md](phase-02-index-content-responsive.md) | pending |
| 03 | Standalone pages (5 files) | [phase-03-standalone-pages.md](phase-03-standalone-pages.md) | pending |
| 04 | Update dashboard-layout skill | [phase-04-update-skill-doc.md](phase-04-update-skill-doc.md) | pending |
| 05 | Manual test responsive | [phase-05-manual-test.md](phase-05-manual-test.md) | pending |

## Dependencies
- 02 cần 01 (main margin đã đổi)
- 03 áp dụng cùng pattern, độc lập 02
- 04 sau 01-03 (doc reflect actual code)
- 05 sau tất cả

## Effort
~4 giờ tổng (revised sau red-team). Phase 02 nặng nhất (75-90 min): 16 tab × 4 sticky variants + modal padding + grid + table.

## Red-team Fixes Applied
- ✅ Z-index map cập nhật (sidebar 50, dropdown line 674 bump xuống 20)
- ✅ Body scroll lock + ESC key + sidebar overflow-y-auto (phase 01)
- ✅ 4 sticky header variants (phase 02)
- ✅ Modal padding responsive (phase 02)
- ✅ `p-8` Edit thay vì replace_all (phase 02)
- ✅ iOS 100vh → 100dvh iframe fallback (phase 03)
- ✅ Landscape viewport test (phase 05)

## Success Criteria
- < 768px: sidebar ẩn, hamburger mở drawer, content 1 cột, padding nhỏ, table cuộn ngang
- ≥ 768px: layout nguyên trạng, không regression
- 5 standalone pages cũng pass
- Skill doc cập nhật pattern mobile + checklist mới
