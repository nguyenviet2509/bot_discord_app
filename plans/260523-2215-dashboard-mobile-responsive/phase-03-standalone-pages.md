# Phase 03 — Standalone Pages Responsive

## Overview
- Priority: MEDIUM
- Effort: 40 phút
- Depends on: nothing (độc lập phase 01/02)

## Files
| File | Note |
|---|---|
| [dashboard/public/automod.html](../../dashboard/public/automod.html) | Có internal tabs (config/logs) |
| [dashboard/public/events.html](../../dashboard/public/events.html) | Recent feature |
| [dashboard/public/honor-config.html](../../dashboard/public/honor-config.html) | Discord embed preview |
| [dashboard/public/levelup-preview.html](../../dashboard/public/levelup-preview.html) | Preview page |
| [dashboard/public/login.html](../../dashboard/public/login.html) | Form login đơn giản |

## Lưu ý đặc biệt
Standalone pages load qua iframe trong index.html → **KHÔNG cần hamburger** (sidebar nằm ngoài iframe, đã handle ở Phase 01). Chỉ cần content responsive.

### iOS Safari 100vh quirk
Iframe trong index.html dùng `style="height:100vh"`. iOS Safari URL bar shrink → 100vh > viewport thật → double-scroll. **Fix:** đổi iframe height sang `100dvh` (dynamic viewport height, supported iOS 15.4+) với fallback:
```html
<iframe ... style="height:100vh; height:100dvh; width:100%; border:0;">
```
Áp dụng cho tất cả iframe blocks trong index.html (honor, automod, events, levelup-preview).

## Transform Patterns (giống Phase 02 nhưng KHÔNG có sidebar drawer)

### A. Sticky header
```html
<!-- Before -->
<div class="bg-white border-b ... px-8 py-5 flex items-center justify-between">
<!-- After -->
<div class="bg-white border-b ... px-4 md:px-8 py-4 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
```
Title block KHÔNG cần `pl-12` vì không có hamburger (sidebar parent handle).

### B. Content padding
`p-8` → `p-4 md:p-8`

### C. Form grids
Như Phase 02.

### D. Tables (automod logs)
`overflow-x-auto` wrapper.

### E. Login page
- Form center vertically + horizontally → `min-h-screen flex items-center justify-center p-4`
- Form card `w-full max-w-md` → giữ nguyên (đã responsive)

### F. Internal tabs (automod.html)
`.tab-btn` flex row → check nếu overflow mobile thì `flex-wrap` hoặc scroll-x.

## Per-file checklist

### automod.html
- [ ] Sticky header
- [ ] Padding
- [ ] Internal tab nav (flex-wrap nếu cần)
- [ ] Logs table overflow

### events.html
- [ ] Sticky header
- [ ] Padding
- [ ] Card grid 1-col mobile

### honor-config.html
- [ ] Sticky header
- [ ] Padding
- [ ] Embed preview card (đảm bảo không tràn ngang)
- [ ] Form grids

### levelup-preview.html
- [ ] Padding
- [ ] Preview container không tràn

### login.html
- [ ] Form đã responsive sẵn → chỉ check padding ngoài

## Success Criteria
Mở mỗi page trực tiếp (không qua iframe) ở 375px → không overflow, form đọc được, button không tràn.
Mở qua index.html iframe ở 375px → cùng kết quả, sidebar drawer của index hoạt động bình thường.
