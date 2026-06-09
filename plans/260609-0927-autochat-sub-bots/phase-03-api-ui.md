# Phase 03 — API Routes + Dashboard UI

**Status:** pending
**Priority:** high
**Depends on:** Phase 01, 02
**Files:** `dashboard/routes/managed-bots.js`, `dashboard/public/index.html` (managed bot section)

## API endpoints

Mount cùng `/api/managed-bots` router. Path `/:id/autochat*`.

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/:id/autochat` | — | `{ config: {enabled, channel_id, min_minutes, max_minutes}, messages: [{id, content}] }` |
| PUT | `/:id/autochat` | `{enabled?, channel_id?, min_minutes?, max_minutes?}` | updated config |
| POST | `/:id/autochat/messages` | `{content}` | `{id, content}` |
| DELETE | `/:id/autochat/messages/:msgId` | — | 204 |
| POST | `/:id/autochat/test` | — | `{sent: true}` hoặc 400 với reason |

### Validation (route layer)

- `min_minutes` ∈ [1, 10080], `max_minutes` >= min_minutes
- `channel_id` regex `^\d{17,20}$`
- `content` length 1..2000
- Bot phải tồn tại (404 nếu không)

### Tích hợp với manager

```js
const manager = require('../../bots-lite')

// PUT autochat: sau khi updateAutochatConfig
const cfg = dbManaged.getAutochatConfig(id)
if (manager.isRunning(id)) {
  if (cfg.enabled && cfg.channel_id) {
    manager.autoChatter.schedule(id, manager._getClient) // hoặc export helper
  } else {
    manager.autoChatter.cancel(id)
  }
}

// POST test: gọi manager.autoChatter.sendOnce(id)
// Yêu cầu bot đang running + có channel + có ít nhất 1 message
```

Thêm export `autoChatter` từ `bots-lite/index.js` (đã làm ở Phase 02).

## UI

### Vị trí

Trong tab/modal quản lý managed bots ở `dashboard/public/index.html`. Tìm section render từng bot → thêm collapsible "Tự động chat" hoặc nút mở modal riêng.

Theo `.claude/rules/dashboard-ui.md` → load skill `dashboard-layout` trước khi viết HTML.

### Components

```
[ ] Bật tự động chat
Channel ID: [_______________]
Khoảng cách: [__] đến [__] phút

Danh sách câu chat:
  • Xin chào ae               [Xoá]
  • Hôm nay đẹp trời ghê      [Xoá]
  • ...
[Thêm câu mới: __________________________] [Thêm]

[Lưu cấu hình]  [Test gửi ngay]
```

### Behavior

- Load: GET autochat khi mở section
- Toggle/min/max/channel: thay đổi local state, có nút "Lưu" để PUT
- Thêm câu: POST ngay (không cần lưu chung), refresh list
- Xoá câu: DELETE ngay, confirm trước
- Test gửi: POST test, hiện toast thành công/lỗi
- Validation client-side: min >= 1, max >= min, channel_id 17-20 số

## Todo

- [ ] Thêm 5 endpoints vào `dashboard/routes/managed-bots.js`
- [ ] Validation helpers (channel id regex, range check)
- [ ] Tích hợp manager.autoChatter trong PUT
- [ ] Load skill dashboard-layout
- [ ] Thêm UI section trong index.html managed bots area
- [ ] JS handlers (fetch + DOM update)
- [ ] Test E2E: tạo config → bật → đợi tick / dùng test button → tắt → message dừng

## Success criteria

- GET trả đúng config + messages
- PUT enabled=true với bot running → message gửi sau random delay
- PUT enabled=false → không còn message
- POST test gửi ngay vào channel
- DELETE message → biến mất khỏi list
- UI persist đúng state sau reload

## Câu hỏi chưa giải quyết

1. UI hiện tại của managed bots ở dạng inline trong bot card hay modal riêng? Cần scan `index.html` khi implement để chọn pattern phù hợp.
2. Có cần permission/role check thêm ngoài middleware auth hiện có không? (mặc định: không, dùng auth chung)
