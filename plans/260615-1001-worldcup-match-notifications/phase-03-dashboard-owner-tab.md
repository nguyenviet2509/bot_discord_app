# Phase 03 — Dashboard Owner Tab (CRUD Matches)

## Context

- Dashboard pattern: `dashboard/public/`, Alpine.js. Tham khảo các tab hiện có (voice-log, vinh-danh).
- Skill bắt buộc: `.claude/skills/dashboard-layout/SKILL.md` (load TRƯỚC khi viết HTML/JS dashboard).
- Auth dashboard: hiện dùng JWT — verify pattern.

## Overview

- Priority: P0
- Status: pending
- Owner (xác định bằng role) quản lý lịch trận đấu + teams qua dashboard.

## Permission model

- Lưu `worldcup_admin_role_id` trong `app_settings` (set Phase 02).
- Backend middleware `requireWorldcupAdmin`: decode JWT → lấy user discord ID → query Discord API hoặc cache role → check user có role này trong **primary guild** (ENV `BOT_PRIMARY_GUILD_ID`).
- UI lần đầu setup: nếu `worldcup_admin_role_id` chưa set → endpoint super-setup (chỉ accept khi DB chưa có giá trị) cho phép set 1 lần. Sau đó chỉ chính owner role mới đổi được.

## Files

### Create
- `dashboard/src/routes/worldcup-admin.js` — Express routes (require admin).
- `dashboard/src/middleware/require-worldcup-admin.js`
- `dashboard/public/worldcup-admin.html` — standalone tab page (theo pattern dashboard-layout skill).
- `dashboard/public/js/worldcup-admin.js` — Alpine.js logic.

### Modify
- `dashboard/src/index.js` (hoặc entry tương đương) — mount routes mới.
- `dashboard/public/index.html` — add nav item "Quản lý Worldcup" (chỉ hiện khi user có role admin).

## API endpoints

```
GET    /api/worldcup/teams                  → list teams
POST   /api/worldcup/teams                  → create team {code,name}
PATCH  /api/worldcup/teams/:id              → update
DELETE /api/worldcup/teams/:id              → delete (block nếu có match ref)

GET    /api/worldcup/matches?round=&from=&to= → list
POST   /api/worldcup/matches                → create {team1Id,team2Id,kickOffAt,round,groupName}
PATCH  /api/worldcup/matches/:id            → update
DELETE /api/worldcup/matches/:id            → delete (+ xoá notification_log)

GET    /api/worldcup/admin-role             → check current role + user permission
POST   /api/worldcup/admin-role             → set (super-setup hoặc owner đổi)
```

Tất cả endpoint qua `requireWorldcupAdmin` trừ super-setup (chỉ chạy được khi DB chưa có role).

## UI layout

**Tab "Quản lý Worldcup"** (standalone page):
- Section "Cấu hình quyền admin": input role ID + nút "Lưu" (chỉ show nếu user là owner).
- Section "Đội tuyển": bảng list 32 đội, form add/edit (code, name), delete.
- Section "Trận đấu": filter (round dropdown, date range), bảng list (sort by kick-off), form add/edit:
  - Dropdown team1, team2 (load `/api/worldcup/teams`).
  - Datetime-local picker (UI local → convert UTC ms khi submit).
  - Round select: group/r16/qf/sf/3rd/final.
  - Group name input (chỉ enable khi round=group).
- Delete có confirm modal.

## Steps

1. Đọc skill `dashboard-layout/SKILL.md`.
2. Tạo middleware `require-worldcup-admin.js`:
   - Lấy JWT → user.id.
   - Query Discord API guild member roles (hoặc dùng cache nếu có sẵn pattern).
   - Check role match `admin_role_id`.
3. Tạo routes `worldcup-admin.js` với endpoints trên, validate input (zod/joi nếu project dùng, không thì manual).
4. Tạo `worldcup-admin.html` + `worldcup-admin.js` Alpine.js theo dashboard-layout skill (cards, input-field, btn-primary).
5. Add nav-item vào sidebar `index.html` (conditional render dựa trên `/api/worldcup/admin-role` check).
6. Test: create team mới, create match, edit, delete, verify DB.

## Todo

- [ ] Middleware require-worldcup-admin
- [ ] Routes teams CRUD
- [ ] Routes matches CRUD
- [ ] Routes admin-role get/set
- [ ] HTML standalone owner tab
- [ ] JS Alpine state + handlers
- [ ] Nav item conditional
- [ ] Manual E2E test trên dashboard

## Success criteria

- Owner login dashboard, vào tab Worldcup, thấy đủ 32 đội seed.
- Tạo match WC ví dụ Brazil vs Argentina kick-off `now+30m` → row xuất hiện trong DB + UI.
- Non-owner truy cập endpoint trả 403.

## Risks

- Discord role check call API mỗi request → cache 60s.
- Datetime timezone: UI dùng `<input type="datetime-local">` local → convert UTC khi POST.

## Next

Phase 04 — per-guild config tab.
