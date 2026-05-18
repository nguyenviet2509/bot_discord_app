# Phase 5 — Dashboard Tab Team + Preview Mode

**Priority:** P1
**Effort:** M (~1h)
**Depends on:** Phase 1, 2

## Backend — `dashboard/routes/honor.js`

Thêm endpoints:
- `GET /api/honor/team-history?limit=10` → list từ `honor_team_history`
- `POST /api/honor/preview` extend: nhận `type: 'top3' | 'team'` trong body
  - type='top3' → `buildHonorEmbed(payload)` (cũ)
  - type='team' → `buildHonorTeamEmbed(payload)`

## Frontend — `dashboard/public/honor-config.html` + `js/honor-config.js`

### Preview section
- Dropdown chọn type: "Cá nhân (Top 3)" / "Team"
- Switch UI: ẩn/hiện form theo type
  - top3: 3 user blocks (như cũ)
  - team: 1 input team_name + 1 textarea reason + repeater 1-10 user (input name + ID)
- Render preview gọi đúng endpoint với `type` set

### History section
- Tabs "Cá nhân" và "Team" (Bootstrap nav-tabs hoặc 2 button toggle)
- Mỗi tab fetch endpoint tương ứng (`/api/honor/history` và `/api/honor/team-history`)

## Files modify
- `dashboard/routes/honor.js` — thêm 1 endpoint + extend preview
- `dashboard/public/honor-config.html` — UI tab + dropdown type
- `dashboard/public/js/honor-config.js` — fetch + render 2 type

## Todo
- [ ] Backend endpoint team-history
- [ ] Extend preview accept type
- [ ] UI tab toggle history
- [ ] UI dropdown preview type
- [ ] Render team embed preview (CSS: list 2 cột)

## Success criteria
- Tab "Cá nhân" và "Team" trong history hoạt động độc lập
- Preview chuyển mode mượt, render đúng embed
- Save settings vẫn dùng chung (1 set role + 1 default channel cho cả 2 type)
