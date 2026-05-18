# Phase 4 — Dashboard Config (Role + Channel)

**Priority:** P1
**Status:** pending
**Effort:** M (~1h)
**Depends on:** Phase 1

## Overview
Trang dashboard cho admin chọn role được phép dùng `/vinhdanh` + default channel. Reuse pattern từ `settings.js` + `discord-roles.js`.

## Related files
- **Create:** `dashboard/routes/honor.js`
- **Create:** `dashboard/public/honor-config.html`
- **Create:** `dashboard/public/js/honor-config.js`
- **Modify:** `dashboard/server.js` (mount route)
- **Modify:** `dashboard/public/index.html` (thêm link "Vinh Danh")

## API endpoints (`/api/honor`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/honor/settings` | Return `{allowed_role_ids: [], default_channel_id}` |
| PUT | `/api/honor/settings` | Body `{allowed_role_ids, default_channel_id}` |
| GET | `/api/honor/history` | Query `?limit=10` → array honor records |

## UI (`honor-config.html`)

- Header "Cấu hình Vinh Danh"
- Section 1: Role được phép dùng
  - Multi-select dropdown (fetch roles từ `/api/discord-roles`)
  - Save button
- Section 2: Channel mặc định
  - Channel select (fetch từ existing endpoint nếu có, hoặc nhập ID)
- Section 3: Lịch sử gần đây
  - Bảng 10 record gần nhất (cột: ngày, tiêu đề, 3 user, người tạo)
  - Link "Xem chi tiết" → mở message Discord (nếu có message_id)

## Implementation steps
1. Tạo `dashboard/routes/honor.js`:
   - GET/PUT settings
   - GET history
   - Validate `allowed_role_ids` là array string
2. Mount route trong `dashboard/server.js`:
   ```js
   app.use('/api/honor', require('./routes/honor'))
   ```
3. Tạo `honor-config.html` + `honor-config.js`:
   - Fetch roles từ `/api/discord-roles`
   - Fetch settings từ `/api/honor/settings`
   - Render multi-select role chips
   - Save handler PUT `/api/honor/settings`
   - Render history table từ `/api/honor/history`
4. Thêm link nav trong `index.html`: "🏛️ Vinh Danh" → `honor-config.html`

## Todo
- [ ] Tạo dashboard/routes/honor.js (3 endpoint)
- [ ] Mount route trong server.js
- [ ] Tạo honor-config.html
- [ ] Tạo honor-config.js
- [ ] Link trong index.html
- [ ] Test: save role → bot dùng đúng

## Success criteria
- Mở dashboard → vào "Vinh Danh" → chọn role → save → reload → role giữ nguyên
- Bot đọc settings đúng khi check permission
- History table hiện 10 record gần nhất
