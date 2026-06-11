# Brainstorm — Dashboard Mobile Responsive

**Date:** 2026-05-23 22:15 | **Branch:** master

## Problem
Dashboard hiện tại không responsive:
- Sidebar `w-60` fixed left + main `ml-60` → mobile vỡ layout
- 0 breakpoint `md:`/`lg:`/`sm:` trong index.html (2041 dòng)
- Form grids cố định cols, padding `p-8` lớn, table không cuộn
- 5 standalone pages (automod, events, honor-config, levelup-preview, login) cũng không responsive

## Decisions
| Vấn đề | Lựa chọn |
|---|---|
| Sidebar mobile | Hamburger drawer (off-canvas trượt từ trái) |
| Breakpoint | `< 768px` = mobile (Tailwind `md:`) |
| Scope | Toàn bộ: index.html + 5 standalone pages + skill update |
| Components | Sidebar drawer, sticky header stack, form grid 1-col, padding shrink, table overflow |

## Design Patterns

### Sidebar drawer
```html
<body x-data="{ tab: 'rewards', sidebarOpen: false }">
  <button @click="sidebarOpen = true" class="md:hidden fixed top-4 left-4 z-30 p-2.5 rounded-lg bg-white shadow border border-slate-200">
    <svg>...menu icon</svg>
  </button>

  <div x-show="sidebarOpen" @click="sidebarOpen = false" x-cloak class="md:hidden fixed inset-0 bg-black/40 z-30"></div>

  <aside class="sidebar-bg w-60 min-h-screen fixed top-0 left-0 flex flex-col z-40 transform transition-transform duration-200 -translate-x-full md:translate-x-0"
         :class="sidebarOpen && '!translate-x-0'">
    <!-- nav items: thêm @click="sidebarOpen=false" -->
  </aside>

  <main class="md:ml-60 flex-1">
```

### Sticky header
```html
<div class="bg-white border-b border-slate-100 sticky top-0 z-10 px-4 md:px-8 py-4 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
  <div class="pl-12 md:pl-0">  <!-- chừa chỗ hamburger -->
    <h1 class="text-lg md:text-xl font-bold text-slate-800">...</h1>
    <p class="text-xs md:text-sm text-slate-400">...</p>
  </div>
  <div class="flex items-center gap-2 md:gap-3 flex-wrap">...buttons</div>
</div>
```

### Content container
`p-8` → `p-4 md:p-8` (toàn bộ)

### Grids
- `grid-cols-2` → `grid-cols-1 md:grid-cols-2`
- `grid-cols-3` → `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`

### Tables
Wrap với `<div class="overflow-x-auto -mx-4 md:mx-0">`. Cell padding shrink mobile.

### Z-index map
| Layer | Z |
|---|---|
| Sticky header | 10 |
| Hamburger button + backdrop | 30 |
| Sidebar (mobile) | 40 |

## Files Impacted

| File | Loại |
|---|---|
| [dashboard/public/index.html](../../dashboard/public/index.html) | SPA chính (2041 dòng), 16 tab |
| [dashboard/public/automod.html](../../dashboard/public/automod.html) | Standalone |
| [dashboard/public/events.html](../../dashboard/public/events.html) | Standalone |
| [dashboard/public/honor-config.html](../../dashboard/public/honor-config.html) | Standalone |
| [dashboard/public/levelup-preview.html](../../dashboard/public/levelup-preview.html) | Standalone (preview) |
| [dashboard/public/login.html](../../dashboard/public/login.html) | Standalone |
| [.claude/skills/dashboard-layout/SKILL.md](../../.claude/skills/dashboard-layout/SKILL.md) | Doc skill |

## Risks
| Risk | Mitigation |
|---|---|
| Regression visual desktop | Chỉ THÊM `md:` prefix vào existing class, không xóa class cũ |
| Sidebar z-index conflict | Z-map cố định: 10/30/40 |
| Iframe pages cao 100vh trên mobile bị padding | Test iframe content tự responsive |
| Hamburger đè title text | Header `pl-12 md:pl-0` chừa chỗ |
| Bot/dashboard restart không cần | Static files, refresh browser đủ |

## Success Criteria
- DevTools responsive < 768px: sidebar ẩn, hamburger hiện, click mở drawer, click backdrop đóng
- Chọn tab → drawer tự đóng
- Sticky header không overflow, button không tràn
- Form grid 1 cột < 768px, multi-cột ≥ 768px
- Table cuộn ngang được, không vỡ layout
- Desktop ≥ 768px: nguyên trạng (không regression)
- 5 standalone pages cũng pass test

## Out of Scope
- Touch gesture (swipe to open drawer)
- Bottom navigation
- Mobile-specific UX optimization (chỉ responsive layout)
- Tablet portrait-specific tuning (gộp vào md breakpoint)

## Unresolved
Không còn.
