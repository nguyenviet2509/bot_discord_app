---
name: dashboard-layout
description: "Bộ hướng dẫn layout/style chuẩn cho mọi trang dashboard mới của bot_discord_app. Use when creating/updating any HTML page, Alpine.js tab, or UI component in dashboard/public/ to keep style consistent with existing tabs (Tin nhắn Level Up, Tin nhắn định kỳ, Welcome, Auto-Mod, Vinh danh)."
metadata:
  scope: project
  applies_to: "dashboard/public/**/*.html, dashboard/public/js/**/*.js, dashboard/public/index.html (SPA tabs)"
---

# Dashboard Layout Skill — bot_discord_app

Mọi trang/tab dashboard mới **PHẢI** tuân theo pattern này để đảm bảo đồng bộ visual với các tab hiện có.

## Khi nào dùng skill này

- Tạo tab mới trong `dashboard/public/index.html` (SPA Alpine.js)
- Tạo standalone page mới trong `dashboard/public/*.html` (load qua iframe từ index.html)
- Tạo/chỉnh dynamic HTML render trong file JS dưới `dashboard/public/js/`
- Restyle trang cũ về chuẩn

## Stack & Dependency chuẩn

| Cái gì | Dùng gì | Ghi chú |
|---|---|---|
| CSS framework | **Tailwind CDN** (`https://cdn.tailwindcss.com`) | KHÔNG dùng Bootstrap |
| Font | **Inter** (Google Fonts) | weights 400/500/600/700 |
| State (SPA tab) | **Alpine.js 3.x** (`x-data`, `x-show`, `x-model`) | đã load global ở `index.html` |
| Charts | Chart.js v4 nếu cần | đã load global |
| Auth | JWT từ `localStorage.token` + header `Authorization: Bearer ...` | pattern trong `js/app.js`, `js/automod.js`, `js/honor-config.js` |

## CSS class chuẩn (đã định nghĩa global trong `index.html`)

Các trang SPA tab dùng trực tiếp các class này. Standalone HTML page **PHẢI copy** lại block CSS này.

```css
.card        /* white bg, rounded-2xl (16px), subtle shadow */
.input-field /* full-width, slate-50 bg, focus ring indigo */
.btn-primary /* indigo-500, white text, padding 10/20, rounded-xl */
.btn-refresh /* white bg, slate-200 border, hover indigo */
```

Bổ sung khi cần (đã có trong `automod.html` / `honor-config.html`):

```css
.btn-success      /* emerald-500 */
.btn-soft-primary /* indigo-50 bg, indigo-700 text */
.btn-soft-danger  /* red-50 bg, red-700 text */
.tab-btn          /* pill button cho tab navigation */
.tab-btn.active   /* indigo-50 bg, indigo-700 text */
.chip             /* removable tag cho whitelist/multi-select */
.toggle-switch    /* iOS-style switch cho boolean */
.field-label      /* slate-700, font-semibold, 13px */
.file-input       /* dashed border upload zone */
```

## Layout pattern cố định

### 1. Sticky Header (top of every tab/page)

```html
<div class="bg-white border-b border-slate-100 sticky top-0 z-10 px-8 py-5 flex items-center justify-between">
  <div>
    <h1 class="text-xl font-bold text-slate-800">[Tên trang]</h1>
    <p class="text-sm text-slate-400 mt-0.5">[Mô tả ngắn]</p>
  </div>
  <div class="flex items-center gap-3">
    <span id="saveStatus" class="text-sm"></span>
    <button class="btn-refresh">...Làm mới</button>
    <!-- Optional: btn-refresh phụ với màu vàng (Gửi thử) -->
    <button class="btn-primary">Lưu thay đổi</button>
  </div>
</div>
```

**Quy tắc:**
- Title: `text-xl font-bold text-slate-800` — **KHÔNG dùng emoji ở đầu title**
- Subtitle: `text-sm text-slate-400 mt-0.5` — mô tả ngắn 1 dòng
- Action buttons bên phải, thứ tự: status text → Làm mới → (optional) action phụ → Save primary
- Z-index: `z-10` để đè content khi scroll

### 2. Content Container

```html
<div class="p-8 max-w-6xl mx-auto">
  <!-- hoặc với space-y-5 nếu nhiều card -->
  <div class="p-8 max-w-6xl mx-auto space-y-5">
    ...
  </div>
</div>
```

- Padding: `p-8` (32px all sides)
- Max width: `max-w-6xl` (~1152px) — không stretch full-screen
- Nhiều card stack: `space-y-5` (20px gap)

### 3. Card

```html
<div class="card p-7">
  <h2 class="text-base font-bold text-slate-800 mb-2">[Section title]</h2>
  <p class="text-sm text-slate-400 mb-5">[Mô tả section]</p>
  <!-- form fields here -->
</div>
```

- Padding bên trong: `p-7` (28px)
- Section title: `text-base font-bold text-slate-800` (16px, **không có emoji ở đầu** trừ khi cần phân loại visual)
- Section sub: `text-sm text-slate-400 mb-5`

### 4. Form Field

```html
<div>
  <label class="field-label">Tên field</label>
  <input class="input-field" />
</div>
```

Hoặc với grid 2-3 cột:

```html
<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
  <div>
    <label class="field-label">A</label>
    <input class="input-field" />
  </div>
  ...
</div>
```

### 5. Toggle Switch (boolean settings)

```html
<label class="toggle-switch">
  <input type="checkbox" />
  <span class="toggle-slider"></span>
</label>
```

### 6. Tab Navigation (trong 1 trang có nhiều tab nhỏ)

```html
<div class="flex items-center gap-2 mb-6 bg-white p-2 rounded-2xl shadow-sm" id="tabs">
  <button class="tab-btn active" data-tab="config">Quy tắc</button>
  <button class="tab-btn" data-tab="logs">Logs</button>
  ...
</div>
<div class="tab-pane" id="tab-config">...</div>
<div class="tab-pane hidden" id="tab-logs">...</div>
```

JS toggle: `classList.toggle('hidden')` + `classList.toggle('active')`.

### 7. Table (logs / lists)

```html
<table class="logs w-full">
  <thead><tr><th>Col</th></tr></thead>
  <tbody>...</tbody>
</table>
```

`table.logs th` uppercase + slate-500. `table.logs td` 13px + hover row.

### 8. Empty/Loading state

```html
<div class="text-sm text-slate-400 italic">Chưa có dữ liệu</div>
<!-- hoặc trong table -->
<tr><td colspan="N" class="text-center text-slate-400 py-8">Đang tải...</td></tr>
```

### 9. Info/Hint Banner

```html
<div class="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-xs text-indigo-700">
  ℹ️ [Hint message]
</div>
<!-- Warning -->
<div class="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
  ⚠️ [Warning]
</div>
```

### 10. Toast (saveStatus)

JS pattern:

```js
function flashSave(text, ok = true) {
  const el = document.getElementById('saveStatus')
  el.textContent = text
  el.className = 'text-sm ' + (ok ? 'text-emerald-600' : 'text-red-600')
  setTimeout(() => { el.textContent = '' }, 2500)
}
```

## Mobile Responsive (BẮT BUỘC)

Breakpoint chuẩn: `< 768px` = mobile (Tailwind `md:`).

### Sidebar drawer pattern (chỉ áp dụng trong `index.html` SPA)
```html
<body x-data="{ tab: '...', sidebarOpen: false }"
      @keydown.escape.window="sidebarOpen=false"
      :class="sidebarOpen && 'overflow-hidden md:overflow-auto'">

  <!-- Hamburger -->
  <button @click="sidebarOpen = true"
          class="md:hidden fixed top-3 left-3 z-30 p-2.5 rounded-lg bg-white shadow-md border border-slate-200">
    <svg>menu icon</svg>
  </button>

  <!-- Backdrop -->
  <div x-show="sidebarOpen" @click="sidebarOpen = false" x-cloak
       x-transition.opacity class="md:hidden fixed inset-0 bg-black/40 z-30"></div>

  <!-- Sidebar: off-canvas mobile, fixed desktop -->
  <aside class="sidebar-bg w-60 h-screen overflow-y-auto fixed top-0 left-0 flex flex-col z-50 transform transition-transform duration-200 -translate-x-full md:translate-x-0"
         :class="sidebarOpen && '!translate-x-0'">
    <!-- Nav items thêm `; sidebarOpen=false` để auto-close -->
    <div @click="tab='X'; sidebarOpen=false" ...>
  </aside>

  <main class="md:ml-60 flex-1 w-full min-w-0">
```

### Sticky header responsive
```html
<div class="bg-white border-b border-slate-100 sticky top-0 z-10 px-4 md:px-8 py-4 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
  <div class="pl-12 md:pl-0">  <!-- chừa chỗ hamburger trong index.html -->
    <h1 class="text-xl font-bold text-slate-800">...</h1>
  </div>
  <div class="flex items-center gap-3 flex-wrap">...buttons</div>
</div>
```
Standalone HTML KHÔNG cần `pl-12 md:pl-0` (sidebar nằm ngoài iframe).

### Content padding
`p-4 md:p-8` thay cho `p-8`.

### Form grids
- `grid-cols-1 md:grid-cols-2` thay `grid-cols-2`
- `grid-cols-1 sm:grid-cols-2 md:grid-cols-3` thay `grid-cols-3`

### Modal padding
`max-w-md p-5 md:p-7` thay `max-w-md p-7`.

### Table overflow
Hoặc card wrapper: `class="card overflow-x-auto"` thay `card overflow-hidden`.
Hoặc: `<div class="overflow-x-auto"><table>...</table></div>`.

### Iframe trong SPA
```html
<iframe ... style="height: 100vh; height: 100dvh; width: 100%; border: 0;">
```
`100dvh` fallback cho iOS Safari URL bar quirk.

### Z-index map cố định
| Element | z-index |
|---|---|
| Dropdown / popover trong content | 20 |
| Sticky header | 10 |
| Hamburger + backdrop | 30 |
| Sidebar (mobile drawer) | 50 |
| Modal | 50 |

## Color Palette (chuẩn)

| Token | Hex | Dùng cho |
|---|---|---|
| Primary | `#6366f1` (indigo-500) | Buttons, focus ring, active states |
| Primary hover | `#4f46e5` (indigo-600) | Button hover |
| Text title | `#1e293b` (slate-800) | Headings |
| Text body | `#334155` (slate-700) | Body, labels |
| Text muted | `#64748b` (slate-500) | Captions |
| Text light | `#94a3b8` (slate-400) | Subtitles, placeholders |
| Border | `#e2e8f0` (slate-200) | Default border |
| BG light | `#f8fafc` (slate-50) | Input bg, hover bg |
| BG page | `#f1f5f9` (slate-100) | Page background |
| Success | `#10b981` (emerald-500) | Save success, positive |
| Danger | `#b91c1c` (red-700) | Errors, delete |
| Warning | `#b45309` (amber-700) | Warnings, test |

## Frontend API Helper (chuẩn)

Mỗi page JS phải dùng helper API gọi backend với JWT:

```js
function getToken() { return localStorage.getItem('token') }

async function api(method, path, body) {
  const token = getToken()
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const r = await fetch(path, opts)
  if (r.status === 401) {
    localStorage.removeItem('token')
    try { window.top.location.href = '/login.html' } catch (_) { window.location.href = '/login.html' }
    throw new Error('Unauthorized')
  }
  if (!r.ok) {
    let err = `HTTP ${r.status}`
    try { err = (await r.json()).error || err } catch (_) {}
    throw new Error(err)
  }
  return r.json()
}
```

**Quan trọng:** Standalone HTML page (load qua iframe) phải redirect qua `window.top` để break iframe khi 401.

## Quyết định kiến trúc: SPA tab vs Standalone page

| Tiêu chí | SPA tab (`index.html`) | Standalone HTML (`*.html` + iframe) |
|---|---|---|
| Code Alpine.js trong `index.html` + section trong `js/app.js` | UI đơn giản, ít form phức tạp | UI nhiều form phức tạp hoặc cần preview riêng |
| Reuse global CSS sẵn có | ✅ Tự động | ❌ Phải copy block style |
| File size | `index.html` to dần | Phân tán, dễ maintain |
| **Quy tắc chọn** | Form ≤ 300 dòng → SPA tab | Form > 300 dòng → Standalone iframe |

Khi dùng standalone HTML qua iframe: **copy nguyên block `<style>` từ template** dưới đây.

## Standalone HTML page Template

Khi tạo trang mới `dashboard/public/my-page.html`:

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>[Tên trang]</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { font-family: 'Inter', -apple-system, sans-serif; }
    .card { background: white; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04); }
    .input-field { width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 12px; font-size: 14px; color: #1e293b; background: #f8fafc; transition: border-color .15s; outline: none; }
    .input-field:focus { border-color: #6366f1; background: white; box-shadow: 0 0 0 3px rgba(99,102,241,.08); }
    .btn-primary { background: #6366f1; color: white; padding: 10px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; border: none; cursor: pointer; transition: background .15s; }
    .btn-primary:hover { background: #4f46e5; }
    .btn-primary:disabled { opacity: .55; cursor: not-allowed; }
    .btn-refresh { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border: 1.5px solid #e2e8f0; border-radius: 12px; font-size: 14px; font-weight: 500; color: #475569; background: white; cursor: pointer; transition: all .15s; }
    .btn-refresh:hover:not(:disabled) { border-color: #a5b4fc; color: #4f46e5; background: #f8fafc; }
    .field-label { font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px; display: block; }
  </style>
</head>
<body class="bg-slate-100 min-h-screen">

<div class="bg-white border-b border-slate-100 sticky top-0 z-10 px-4 md:px-8 py-4 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
  <div>
    <h1 class="text-xl font-bold text-slate-800">[Tên trang]</h1>
    <p class="text-sm text-slate-400 mt-0.5">[Mô tả]</p>
  </div>
  <div class="flex items-center gap-3 flex-wrap">
    <span id="saveStatus" class="text-sm"></span>
    <button id="saveBtn" class="btn-primary">Lưu thay đổi</button>
  </div>
</div>

<div class="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
  <div class="card p-7">
    <h2 class="text-base font-bold text-slate-800 mb-2">Section title</h2>
    <p class="text-sm text-slate-400 mb-5">Section description</p>
    <!-- content -->
  </div>
</div>

<script src="/js/my-page.js"></script>
</body>
</html>
```

## Sidebar nav-item Template

Khi thêm tab mới vào sidebar `index.html`:

```html
<div @click="tab='myfeature'" :class="tab==='myfeature' ? 'active' : ''" class="nav-item">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <!-- icon path từ lucide.dev -->
  </svg>
  <span>Tên hiển thị</span>
</div>
```

Nếu standalone, thêm iframe block ở cuối index.html:

```html
<div x-show="tab === 'myfeature'" class="h-screen">
  <iframe src="/my-page.html" class="w-full h-full border-0" style="height:100vh;height:100dvh;width:100%;border:0;" loading="lazy"></iframe>
</div>
```

## Quy tắc tiếng Việt
- Title/labels/messages **bằng tiếng Việt có dấu**, không viết tắt
- Tên technical (rule names, action types, API endpoints) giữ tiếng Anh nếu là identifier
- Theo `.claude/rules/i18n.md`

## Checklist trước khi finalize trang mới

- [ ] Tailwind CDN + Inter font đã load
- [ ] CSS classes `.card .input-field .btn-primary .btn-refresh` đã có (hoặc inherit từ index.html)
- [ ] Sticky header với title 20px slate-800 + subtitle 14px slate-400 + buttons phải
- [ ] Content `p-8 max-w-6xl mx-auto`
- [ ] Card section dùng `text-base font-bold text-slate-800` cho heading
- [ ] Form labels dùng `.field-label`
- [ ] Inputs dùng `.input-field` (không Bootstrap `form-control`)
- [ ] Buttons dùng `.btn-primary` / `.btn-refresh` / `.btn-success`
- [ ] API helper có JWT Bearer + 401 redirect tới `/login.html` qua `window.top`
- [ ] Title trong sidebar (nếu thêm tab mới) + iframe block trong index.html
- [ ] Empty state + loading state + error toast với `saveStatus`
- [ ] Test responsive: `grid-cols-1 md:grid-cols-2` / `lg:grid-cols-3`
- [ ] Sticky header dùng `flex-col md:flex-row` + `gap-3`
- [ ] Title block trong index.html SPA có `pl-12 md:pl-0` (chừa hamburger)
- [ ] Content wrapper `p-4 md:p-8`
- [ ] Modal `p-5 md:p-7`
- [ ] Table wrap `overflow-x-auto` (hoặc card cha)
- [ ] Iframe `style="height: 100vh; height: 100dvh"` (iOS fallback)
- [ ] Nav-item index.html: `@click` thêm `; sidebarOpen=false`
- [ ] Test DevTools 375px (portrait) + 667x375 (landscape)
- [ ] Không có Bootstrap class (`form-control`, `btn`, `d-flex`, `mb-3`, etc.)

## Anti-patterns (KHÔNG làm)

- ❌ Mix Bootstrap với Tailwind
- ❌ Inline style cho thứ đã có class (`style="padding:10px..."`)
- ❌ Title bắt đầu bằng emoji (giữ emoji ở subtitle hoặc icon riêng)
- ❌ `text-muted` (Bootstrap) — dùng `text-slate-400/500`
- ❌ Page width fixed quá nhỏ (< 800px) → dùng `max-w-6xl`
- ❌ Không có auth check / 401 handler trong API helper
- ❌ Sticky header thiếu `z-10` (bị card overlay)
- ❌ Card không có padding (dùng `p-7` mặc định)
- ❌ Sticky header `flex items-center` cố định không có `flex-col md:flex-row` (mobile button tràn)
- ❌ `grid-cols-2` / `grid-cols-3` không có `grid-cols-1` mobile fallback
- ❌ Table không wrap `overflow-x-auto` (tràn ngang mobile)
- ❌ Quên `sidebarOpen=false` trong nav-item @click (drawer không tự đóng)
- ❌ Iframe chỉ `height: 100vh` mà không có `100dvh` fallback (iOS double-scroll)
- ❌ Z-index dropdown `z-30` trong content (collide với hamburger/backdrop) — dùng `z-20`

## Reference files

| File | Vai trò |
|---|---|
| `dashboard/public/index.html` | Master SPA, định nghĩa CSS global `.card .input-field .btn-primary .btn-refresh` |
| `dashboard/public/automod.html` | Tham chiếu standalone HTML có nhiều tab nội bộ |
| `dashboard/public/honor-config.html` | Tham chiếu standalone HTML có Discord embed preview |
| `dashboard/public/js/automod.js` | Tham chiếu vanilla JS với api() helper + render functions |
| `dashboard/public/js/app.js` | Tham chiếu Alpine.js sections (scheduledMessagesSection, levelUpTemplateSection,...) |

**Khi user yêu cầu tạo/chỉnh trang dashboard, LOAD skill này TRƯỚC khi viết code.**
