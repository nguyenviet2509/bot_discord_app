# Phase 02 — Index Content Responsive (16 tabs)

## Overview
- Priority: HIGH
- Effort: **75-90 phút** (revised — 16 tab + 11 sticky variants + modal padding + grid + table)
- Depends on: Phase 01
- Risk: regression visual — chỉ THÊM `md:` prefix, không xóa class cũ

## File
[dashboard/public/index.html](../../dashboard/public/index.html) — toàn bộ block tab content từ line ~130 đến line cuối

## Transform Patterns (search-replace có hệ thống)

### A. Sticky header — 4 variants (KHÔNG dùng replace_all)
Có 4 variant sticky header trong index.html. Xử lý riêng từng cái (Edit tool, search context đủ dài):

**Variant 1 — base (7 occurrences):**
```html
<!-- Before -->
... px-8 py-5 flex items-center justify-between">
<!-- After -->
... px-4 md:px-8 py-4 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
```

**Variant 2 — có `gap-4 flex-wrap` (line ~975, ~1600, ~1728):**
```html
<!-- Before -->
... px-8 py-5 flex items-center justify-between gap-4 flex-wrap">
<!-- After -->
... px-4 md:px-8 py-4 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 flex-wrap">
```

**Variant 3 — không có `flex` (line ~1474, settings):**
```html
<!-- Before -->
... px-8 py-5">
<!-- After -->
... px-4 md:px-8 py-4 md:py-5">
```

**Variant 4 — bất kỳ pattern khác**: tìm bằng grep `sticky top-0 z-10` rồi sửa thủ công.

Title block trong mọi variant: thêm `pl-12 md:pl-0`:
```html
<div class="pl-12 md:pl-0">
  <h1 class="text-lg md:text-xl font-bold text-slate-800">...</h1>
```

Header inner div (title block) → thêm `pl-12 md:pl-0` để chừa chỗ hamburger:
```html
<div class="pl-12 md:pl-0">
  <h1 class="text-lg md:text-xl font-bold text-slate-800">...</h1>
```

Action buttons div → `flex items-center gap-2 md:gap-3 flex-wrap`

### B. Content padding (CẨN THẬN — không dùng replace_all)
`p-8` xuất hiện ~11 lần với context khác nhau. Variants:
- `class="p-8"` (đơn) → `class="p-4 md:p-8"`
- `class="p-8 space-y-6"` (line ~816) → `class="p-4 md:p-8 space-y-6"`
- `class="p-8 max-w-6xl mx-auto"` → `class="p-4 md:p-8 max-w-6xl mx-auto"`

Dùng Edit tool với search string đủ ngữ cảnh, KHÔNG `replace_all "p-8"` (sẽ match `lg:p-8`, `sm:p-8` etc).

### C. Form grids
- `grid-cols-2` → `grid-cols-1 md:grid-cols-2`
- `grid-cols-3` → `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`
- `md:grid-cols-2` đã có → giữ nguyên (đã responsive sẵn)
- `md:grid-cols-3` đã có → giữ nguyên

### D. Cards
- `card p-7` (section card) → giữ nguyên (28px OK cho mobile)
- Nếu thấy `max-w-6xl mx-auto` → giữ nguyên

### D2. Modal content padding
Modal inner (line ~208, ~606, ~1234 etc) thường có `p-7` cho form modal. Mobile `max-w-md p-7` bóp field. Đổi:
- Modal body `p-7` → `p-5 md:p-7`
- Modal header `px-7 py-5` → `px-5 md:px-7 py-4 md:py-5`

### E. Tables
Mỗi `<table>` wrap với:
```html
<div class="overflow-x-auto -mx-4 md:mx-0">
  <table class="w-full min-w-[600px] md:min-w-0">...</table>
</div>
```

### F. Text size
- Title trong card `text-xl` desktop → giữ
- Big numbers/stat → check nếu vượt mobile thì `text-2xl md:text-3xl`

## Implementation Approach
1. Đọc toàn bộ file từ line 130-2041 phân thành các tab block (mỗi `<div x-show="tab === 'X'">` là 1 block)
2. Áp dụng transform A-F cho từng block
3. Dùng Edit tool với pattern search-replace có `replace_all` cho các case lặp lại (sticky header pattern xuất hiện 16 lần)
4. Verify không có inline `style="margin-left:...px"` nào dư

## Todo
- [ ] Sticky header pattern thay đổi (replace_all)
- [ ] `p-8` → `p-4 md:p-8` (replace_all với context để tránh nhầm)
- [ ] Form grids cập nhật cho từng tab (manual per-tab vì context khác nhau)
- [ ] Wrap tables với overflow-x-auto
- [ ] Test từng tab trên DevTools 375px

## Success Criteria
- Tất cả 16 tab: < 768px render gọn, không overflow ngang
- Form 1 cột mobile, multi-cột desktop
- Table cuộn ngang được, header sticky vẫn hoạt động
- Desktop layout y nguyên

## Risks
- `replace_all` có thể match nhầm pattern khác → review từng replace
- Có thể có tab dùng layout khác chuẩn (vd nested grid) → manual handle
