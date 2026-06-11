# Phase 04 — Update Dashboard-Layout Skill

## Overview
- Priority: MEDIUM
- Effort: 15 phút
- Depends on: Phase 01-03 (doc reflect actual implementation)

## File
[.claude/skills/dashboard-layout/SKILL.md](../../.claude/skills/dashboard-layout/SKILL.md)

## Changes

### 1. Thêm section "Mobile Responsive" sau "Layout pattern cố định"
Nội dung:
- Breakpoint: `< 768px` (Tailwind `md:`)
- Sidebar drawer pattern (copy snippet từ phase-01)
- Sticky header stack pattern: `px-4 md:px-8 py-4 md:py-5 flex flex-col md:flex-row`
- Content padding: `p-4 md:p-8`
- Form grid: `grid-cols-1 md:grid-cols-2/3`
- Table: wrap `overflow-x-auto -mx-4 md:mx-0`
- Z-index map: sticky=10, hamburger+backdrop=30, sidebar=40

### 2. Cập nhật Standalone Template
Thay block sticky header trong template (line ~289) bằng pattern responsive mới.
Thay `<div class="p-8 max-w-6xl mx-auto space-y-5">` → `<div class="p-4 md:p-8 max-w-6xl mx-auto space-y-5">`.

### 3. Mở rộng Checklist (line ~339)
Thêm các mục:
- [ ] Sticky header dùng `flex-col md:flex-row` + gap-3
- [ ] Title block có `pl-12 md:pl-0` (SPA tab có hamburger)
- [ ] Content wrapper `p-4 md:p-8`
- [ ] Form grids responsive `grid-cols-1 md:grid-cols-X`
- [ ] Table wrap `overflow-x-auto -mx-4 md:mx-0`
- [ ] Test ở DevTools 375px (iPhone SE width)
- [ ] Nav-item trong index.html SPA: `@click` thêm `; sidebarOpen=false`

### 4. Cập nhật Anti-patterns
Thêm:
- ❌ Sticky header dùng `flex items-center` cố định → không stack được mobile
- ❌ Grid `grid-cols-3` không có `grid-cols-1` mobile fallback
- ❌ Table không có wrapper `overflow-x-auto`
- ❌ Quên auto-close `sidebarOpen=false` khi click nav-item

## Todo
- [ ] Insert section "Mobile Responsive" với code snippets
- [ ] Update standalone template
- [ ] Mở rộng checklist
- [ ] Thêm anti-patterns

## Success Criteria
Future agent đọc skill → biết pattern responsive ngay, không cần guess.
