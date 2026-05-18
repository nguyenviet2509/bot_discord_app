# Phase 5 — Dashboard Preview Embed

**Priority:** P1
**Status:** pending
**Effort:** M (~1h)
**Depends on:** Phase 2

## Overview
Trang preview cho phép admin nhập đầy đủ thông tin → render embed giống Discord (Mock 4 Champion Spotlight) trước khi gửi thật. Pattern theo `levelup-preview.html` đã có.

## Related files
- **Create:** `dashboard/public/honor-preview.html`
- **Create:** `dashboard/public/js/honor-preview.js`
- **Modify:** `dashboard/routes/honor.js` (thêm endpoint preview)

## API endpoint

```
POST /api/honor/preview
Body: { title, user1: {id, name?, reason}, user2: ..., user3: ..., bannerUrl }
Response: { content, embeds }  // output từ buildHonorEmbed
```

- Server-side: import `shared/build-honor-embed.js` → gọi `buildHonorEmbed(payload)` → return
- Nếu thiếu name → fetch user info từ bot client (qua endpoint riêng `/api/discord-user/:id`) hoặc accept name từ client

## UI flow

1. Form inputs:
   - Title (text)
   - 3 user blocks: input user ID + tên hiển thị + lý do
   - Banner URL (text — paste URL hoặc upload→tạm thời chỉ URL)
2. Button "Preview" → POST `/api/honor/preview` → render embed clone style Discord
3. Render embed bằng HTML+CSS tương tự `plans/visuals/honor-mocks.html` Mock 4
4. **Không** gửi thật — chỉ preview

## Implementation steps
1. Thêm endpoint `POST /api/honor/preview` vào `dashboard/routes/honor.js`
2. Tạo `honor-preview.html` với form + khung preview
3. Tạo `honor-preview.js`:
   - Bind form submit → fetch API → render kết quả
   - CSS Discord-like (copy từ honor-mocks.html)
4. Thêm link "Preview" từ `honor-config.html` qua trang này

## Todo
- [ ] Thêm POST /api/honor/preview vào route
- [ ] Tạo honor-preview.html
- [ ] Tạo honor-preview.js + CSS Discord-style
- [ ] Test: paste data → preview render đúng

## Success criteria
- Nhập đủ thông tin → bấm Preview → thấy embed render giống Discord thật
- Banner URL hiển thị đúng vị trí (cuối embed)
- Thumbnail = avatar #1 góc phải trên
- Fields inline #2, #3 nằm ngang
- Không có lỗi nếu thiếu optional fields
