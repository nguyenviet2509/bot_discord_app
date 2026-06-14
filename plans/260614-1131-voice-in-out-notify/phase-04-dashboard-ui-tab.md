---
phase: 4
title: Dashboard UI tab
status: completed
priority: P1
effort: 1h
dependencies:
  - 3
---

# Phase 4: Dashboard UI tab

## Overview

Thêm tab "Theo dõi voice" vào dashboard SPA: nav-item trong sidebar + section x-show + Alpine module xử lý form. Style theo skill `.claude/skills/dashboard-layout`.

## Requirements

**Functional:**
- Nav-item mới "Theo dõi voice" trong sidebar (đặt sau "Vinh danh" hoặc gần các cấu hình kênh)
- Section x-show="tab === 'voice-log'" với:
  - Toggle "Bật theo dõi"
  - Dropdown chọn notify channel (chỉ text channels)
  - Checklist multi-select voice channels (chỉ voice channels)
  - 2 textarea: join_template, leave_template (kèm hint placeholders)
  - Nút "Lưu"
  - Nút Refresh ở sticky header
- Alpine section trong file mới `dashboard/public/js/voice-log.js`, register `Alpine.data('voiceLogSection', ...)`
- Load qua `<script src="/js/voice-log.js">` trong `index.html`

**Non-functional:**
- File `voice-log.js` ≤ 150 LOC
- Style consistent: `.card`, `.input-field`, `.btn-primary`, `.btn-refresh`, indigo/slate (theo skill `dashboard-layout`)
- Mobile responsive (giống các tab khác — sticky header `flex-col md:flex-row`)
- Toast feedback save success/fail

## Architecture

Alpine data structure:
```js
{
  loading: false, saving: false, toast: null,
  form: { enabled: false, notify_channel_id: '', watched_channels: [], join_template: '', leave_template: '' },
  channels: { voice: [], text: [] },
  async init() { await Promise.all([this.loadCfg(), this.loadChannels()]) },
  async loadCfg() { /* GET /api/voice-log → form */ },
  async loadChannels() { /* GET /api/discord/channels → split voice/text */ },
  toggleWatched(id) { /* add/remove in this.form.watched_channels */ },
  async save() { /* PUT /api/voice-log */ },
  showToast(msg, color) { ... },
}
```

API helper: dùng pattern hiện có trong `dashboard/public/js/app.js` (fetch với `Authorization: Bearer ${token}`, 401 → redirect login). Kiểm tra `app.js` để reuse hàm `apiFetch` (hoặc tương tự).

## Related Code Files

- Modify: `dashboard/public/index.html`
  - Sidebar: thêm `<div @click="tab='voice-log'..." class="nav-item">` (icon: microphone hoặc volume-2 từ Feather)
  - Main: thêm `<div x-show="tab === 'voice-log'" x-data="voiceLogSection">` với sticky header + content card
  - Thêm `<script src="/js/voice-log.js"></script>` ở head/before close body
- Create: `dashboard/public/js/voice-log.js`

## Implementation Steps

1. **Đọc `dashboard/public/js/app.js`** xem có helper `apiFetch`/`fetchAuth` chưa, để reuse trong `voice-log.js`. Nếu không có, copy pattern từ `welcome-template.js` hoặc tương tự.

2. **Tạo `dashboard/public/js/voice-log.js`**:
   - Đăng ký Alpine component qua `document.addEventListener('alpine:init', () => Alpine.data('voiceLogSection', () => ({...})))`
   - `init()` fetch cfg + channels song song
   - `toggleWatched(id)` push/splice id trong `form.watched_channels`
   - `save()` PUT, handle 4xx hiển thị `error` message từ server, 2xx hiển thị toast xanh "Đã lưu"

3. **Modify `dashboard/public/index.html`**:
   - Thêm nav-item (cùng style với các item khác): icon volume + label "Theo dõi voice"
   - Thêm section x-show tab voice-log với cấu trúc:
     ```html
     <div x-show="tab === 'voice-log'" x-data="voiceLogSection" x-init="init()">
       <!-- sticky header với title + nút refresh -->
       <!-- card 1: toggle + dropdown notify -->
       <!-- card 2: checklist voice channels -->
       <!-- card 3: textarea join_template + leave_template với hint placeholders -->
       <!-- nút Lưu -->
     </div>
     ```
   - Thêm `<script src="/js/voice-log.js"></script>` đặt cùng các script khác.

4. **Hint placeholders text** (hiển thị dưới textarea):
   ```
   Placeholders: {user} (mention), {username} (không mention), {channel} (tên voice), {time} (giờ HH:mm)
   ```

5. **Empty state**: nếu `channels.voice.length === 0` → hiển thị "Server chưa có voice channel" trong card whitelist.

6. **Compile check**: mở dashboard trong browser, mở DevTools Console → không có error JS khi switch tab.

## Success Criteria

- [ ] Tab "Theo dõi voice" xuất hiện trong sidebar, click → section hiển thị
- [ ] Khi mở tab lần đầu: form load đúng default (enabled false, template default tiếng Việt)
- [ ] Dropdown notify channel chỉ list text channel
- [ ] Checklist voice channels render đầy đủ voice channel của server
- [ ] Tick 1 voice channel → `form.watched_channels` cập nhật, bấm Lưu → toast "Đã lưu", refresh page → checkbox vẫn tick
- [ ] PUT lỗi (vd template rỗng) → toast đỏ hiển thị message từ server
- [ ] Style đồng nhất với các tab khác (card, indigo, sticky header)

## Risk Assessment

- **Risk**: Server có > 50 voice channels → checklist dài. Mitigated: scroll trong card với max-height + overflow-y-auto.
- **Risk**: Quên register script `voice-log.js` trước Alpine init → Alpine.data sẽ throw. Kiểm tra thứ tự `<script>` trong `index.html`.

## Security Considerations

- Token gửi qua `Authorization: Bearer` header, không log
- Validate input client-side là UX, vẫn để server validate là source of truth
