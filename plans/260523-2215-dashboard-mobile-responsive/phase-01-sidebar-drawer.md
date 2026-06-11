# Phase 01 — Sidebar Drawer + Hamburger

## Overview
- Priority: HIGH (blocker phase 02)
- Effort: 30 phút
- Risk: trung bình (z-index, Alpine state)

## File
[dashboard/public/index.html](../../dashboard/public/index.html) — chỉ phần body root + sidebar + main wrapper (line 41-128 area)

## Changes

### 1. Root x-data thêm `sidebarOpen`
**Before** (line 41):
```html
<body class="bg-slate-100 min-h-screen" x-data="{ tab: 'rewards' }" ...>
```
**After**:
```html
<body class="bg-slate-100 min-h-screen" x-data="{ tab: 'rewards', sidebarOpen: false }" ...>
```

### 2. Hamburger button (thêm sau `<div class="flex min-h-screen">`)
```html
<button @click="sidebarOpen = true"
        class="md:hidden fixed top-3 left-3 z-30 p-2.5 rounded-lg bg-white shadow-md border border-slate-200 text-slate-700 hover:bg-slate-50"
        aria-label="Mở menu">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
</button>
```

### 3. Backdrop (đặt ngay trước `<aside>`)
```html
<div x-show="sidebarOpen" @click="sidebarOpen = false" x-cloak
     x-transition.opacity
     class="md:hidden fixed inset-0 bg-black/40 z-30"></div>
```

### 4. Sidebar — thêm transform + transition + overflow-y-auto
**Before** (line 45):
```html
<aside class="sidebar-bg w-60 min-h-screen fixed top-0 left-0 flex flex-col z-20">
```
**After**:
```html
<aside class="sidebar-bg w-60 h-screen overflow-y-auto fixed top-0 left-0 flex flex-col z-50 transform transition-transform duration-200 -translate-x-full md:translate-x-0"
       :class="sidebarOpen && '!translate-x-0'">
```
**Lưu ý:** `h-screen overflow-y-auto` để nav scroll được khi landscape phone (16 nav-item có thể vượt viewport).

### 4b. ESC key + body scroll lock
Thêm vào body:
```html
<body ... @keydown.escape.window="sidebarOpen=false"
      :class="sidebarOpen && 'overflow-hidden md:overflow-auto'">
```

### 5. Nav items — auto-close drawer khi chọn tab
Mỗi `<div @click="tab='X'" ...>` thêm `; sidebarOpen=false`:
```html
<div @click="tab='servers'; sidebarOpen=false" :class="..." class="nav-item">
```
Tất cả 16 nav-item + logout button.

### 6. Main margin
**Before** (line 128):
```html
<main class="ml-60 flex-1">
```
**After**:
```html
<main class="md:ml-60 flex-1 w-full">
```

### 5b. Z-index bump dropdown (avoid collision)
Tìm `class="absolute z-30 mt-2 ...` (line ~674, search dropdown) → đổi `z-30` thành `z-20`. Hamburger=30, backdrop=30, sidebar=50.

**Z-index map cập nhật:**
| Element | z |
|---|---|
| Dropdown search (line 674) | 20 (was 30) |
| Sticky header | 10 |
| Hamburger + backdrop | 30 |
| Sidebar | 50 (was 40) |
| Modal (giữ nguyên) | 50 |

## Todo
- [ ] Update body x-data (thêm sidebarOpen + ESC + scroll lock)
- [ ] Add hamburger button (z-30)
- [ ] Add backdrop overlay (z-30)
- [ ] Update aside class (h-screen overflow-y-auto z-50 + transform)
- [ ] Update 16 nav-item + logout với `sidebarOpen=false`
- [ ] Update main margin (`md:ml-60`)
- [ ] Bump dropdown line 674: z-30 → z-20
- [ ] Refresh browser, test ở DevTools 375px + landscape 667x375 + ESC key

## Success Criteria
- DevTools 375px: sidebar ẩn, hamburger hiện
- Click hamburger → sidebar slide vào, backdrop overlay
- Click backdrop → đóng
- Click nav-item → đóng + chuyển tab
- DevTools ≥ 768px: sidebar luôn hiện, hamburger ẩn, behavior cũ
