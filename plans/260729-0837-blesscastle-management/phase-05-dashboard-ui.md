# Phase 05: Dashboard UI Tab

**Priority:** High | **Status:** pending
**Depends on:** Phase 04

## Overview
Tab "BlessCastle" trong SPA dashboard. Alpine.js component. **BẮT BUỘC** load skill `dashboard-layout` trước khi viết CSS/HTML.

## Files
- **Create:** `dashboard/public/js/blesscastle-tab.js` (~200 LOC Alpine component)
- **Modify:**
  - `dashboard/public/index.html` — add nav-item + tab section (dùng template chuẩn từ skill)
  - Có thể chia HTML template ra file riêng nếu section > 200 LOC

## UI sections (sticky header + content container theo dashboard-layout)

### 1. Config card
- Multi-select voice channels (Choices.js pattern nếu đã dùng, hoặc native `<select multiple>` với UI đẹp)
- Input min_minutes (number, min=1, max=180)
- Input session_start_hour / session_end_hour (0-23)
- Toggle switch `enabled`
- Nút "Lưu cấu hình" (btn-primary)

### 2. Members table
- Search input (filter theo username)
- Sort dropdown: stars DESC (default) / stars ASC / recent activity
- Table rows:
  - Avatar (32px) | Tên | ⭐ badge với số | Progress tuần này | [Tick tham gia thủ công] toggle | [Đã đổi quà] (btn-primary, disabled khi stars < 3)
- Progress: "20/30 phút" progress bar + badge "✓ Đã đạt" khi voice ≥ min hoặc manual=1
- Manual tick toggle disabled sau 19h thứ 6

### 3. Redemption history
- Bảng: Avatar + tên | Ngày đổi | Admin bấm | Sao tại thời điểm đó
- Pagination hoặc "Load more" nếu > 50

### 4. Info banner
- Text giải thích quy tắc: "Voice 20-21h thứ 6 ≥ 30 phút, hoặc admin tick từ T2 đến 19h T6 → +1 sao. Đủ 3 sao → đổi quà."

## API helper
- Dùng API helper chuẩn từ skill dashboard-layout (JWT auth, 401 redirect)
- Endpoints: xem phase-04

## Nav item (sidebar)
- Icon: 🏰 hoặc ⭐
- Label: "BlessCastle"

## Todo
- [ ] Load skill `dashboard-layout` — copy template chuẩn card/table/btn
- [ ] Nav-item + `<section x-show="tab === 'blesscastle'">` trong index.html
- [ ] Alpine component `blesscastleTab()` với data: config, members, redemptions, loading, error
- [ ] Fetch tất cả on tab mount
- [ ] Save config → PUT + toast success
- [ ] Toggle manual attendance → POST/DELETE
- [ ] Redeem button → confirm modal → POST redeem → refresh members + history
- [ ] Client-side check giờ hiện tại (Asia/Saigon) để disable manual tick sau 19h T6

## Success Criteria
- Tab hiển thị đúng style consistent với các tab khác
- Config save persist qua reload
- Tick manual → visual feedback + reflect ở progress
- Nút "Đã đổi quà" chỉ enable khi stars >= 3
- Bấm → confirm → stars về 0, xuất hiện trong history
- Responsive OK trên mobile (viewport 375px)

## Risks
- Choices.js hoặc lib multi-select đã có sẵn không? Check `dashboard/public/index.html` head
- Progress bar CSS: tự viết hoặc dùng Tailwind (check dashboard đang dùng gì)
- Timezone client-side có thể lệch — vẫn nên rely server-side validation
