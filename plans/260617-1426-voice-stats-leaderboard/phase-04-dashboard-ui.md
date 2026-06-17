# Phase 04 - Dashboard Tab + API

## Context Links
- Plan: [plan.md](plan.md)
- Phase 01 helpers: [phase-01-db-schema.md](phase-01-db-schema.md)
- Dashboard skill: `.claude/skills/dashboard-layout/SKILL.md` (BẮT BUỘC load trước khi viết HTML/JS)
- Reference tab: `dashboard/public/voice-log.html` + `dashboard/public/js/voice-log.js` + `dashboard/routes/voice-log.js`

## Overview
- **Priority**: P3
- **Status**: pending
- **Mục tiêu**: tab "Thống kê Voice" trong dashboard với leaderboard + filter range, toggle bật/tắt feature.

## API Endpoints

### `GET /api/voice-stats?range=7d&from=&to=&limit=20`
- Query params:
  - `range`: `today` | `7d` | `30d` | `all` | `custom`
  - `from`, `to`: ISO date hoặc unix sec (chỉ dùng khi `range=custom`)
  - `limit`: 5-100 (default 20)
- Response:
  ```json
  {
    "range": { "from": 1234, "to": 5678, "label": "7 ngày qua" },
    "leaderboard": [
      {
        "user_id": "123",
        "display_name": "User",
        "avatar_url": "...",
        "total_sec": 45240,
        "join_count": 45,
        "top_channel": { "id": "...", "name": "voice-1", "total_sec": 12345 }
      }
    ],
    "total_members": 47
  }
  ```
- Display name + avatar: fetch từ Discord client (passing bot client vào dashboard, hoặc cache trong DB). Check pattern các route khác.

### `GET /api/voice-stats/settings`
- Response: `{ voice_stats_enabled: boolean }`

### `PUT /api/voice-stats/settings`
- Body: `{ voice_stats_enabled: boolean }`
- Toggle on/off

## UI (HTML + Alpine.js)

Theo pattern dashboard-layout skill:
- Sticky header với title + toggle switch "Bật/tắt thống kê"
- Filter row: select range (preset) + 2 date input (hiện khi chọn custom) + button "Áp dụng"
- Bảng leaderboard:
  | # | Avatar + Tên | Tổng thời gian | Số lần join | Channel ưa thích |
- Top 3 có icon medal (🥇🥈🥉)
- Empty state: "Chưa có dữ liệu trong khoảng này"
- Pagination/limit: dropdown chọn 10/20/50/100

## Sidebar Nav

Thêm nav-item "Thống kê Voice" trong `dashboard/public/index.html` (icon mic/chart).

## Related Code Files
- **Create**: `dashboard/routes/voice-stats.js` (~80 LOC)
- **Modify**: `dashboard/server.js` (hoặc `dashboard/app.js`) - register route
- **Create**: `dashboard/public/voice-stats.html`
- **Create**: `dashboard/public/js/voice-stats.js`
- **Modify**: `dashboard/public/index.html` - sidebar nav-item

## Implementation Steps

1. **Load skill** `.claude/skills/dashboard-layout/SKILL.md`
2. Đọc `dashboard/routes/voice-log.js` + `voice-log.html` để follow pattern
3. Tạo route `voice-stats.js`:
   - GET leaderboard với resolve range
   - GET/PUT settings
4. Register vào main server
5. Tạo HTML tab theo template skill (sticky header + content container)
6. Tạo JS Alpine.js: fetch + render bảng + handle filter change
7. Thêm sidebar nav-item
8. Test browser: filter các range, custom date, toggle on/off
9. Test 401 redirect (JWT helper từ skill)

## Todo
- [ ] Load dashboard-layout skill
- [ ] Đọc voice-log.* để follow pattern
- [ ] Route + API
- [ ] HTML tab
- [ ] JS Alpine
- [ ] Sidebar nav
- [ ] Manual browser test

## Success Criteria
- Tab load không lỗi, hiển thị leaderboard
- Filter range thay đổi → bảng update đúng
- Custom date range → từ-đến hợp lệ
- Toggle off → UI báo "Đã tắt" + bot không track
- Số liệu khớp với `/voicetop` cùng range
- Responsive mobile (skill yêu cầu)

## Risks
- Avatar URL từ Discord cache có thể null nếu member rời server → fallback default avatar
- Resolve display name 100 user/request → có thể chậm, cân nhắc batch hoặc cache 5min
- Custom date range timezone: server vs client → fix Asia/Saigon ở backend
