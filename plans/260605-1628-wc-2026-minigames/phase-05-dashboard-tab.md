# Phase 05 — Dashboard Tab "WC 2026"

**Status:** pending | **Priority:** P0 | **Effort:** M (~1 ngày)
**Depends on:** Phase 01

## Context

Existing dashboard pattern: [dashboard/public/honor-config.html](../../dashboard/public/honor-config.html), [dashboard/routes/honor.js](../../dashboard/routes/honor.js). Rule UI: **MUST** load `.claude/skills/dashboard-layout/SKILL.md` trước khi code.

## Files

**Create:**
- `dashboard/public/wc-2026.html` — tab WC: settings + prizes config + leaderboard
- `dashboard/routes/wc-pickem.js` — API endpoints

**Modify:**
- `dashboard/public/index.html` — thêm nav item "WC 2026"
- `dashboard/public/js/app.js` — Alpine.js tab logic (nếu dùng pattern SPA)
- `dashboard/server.js` (hoặc nơi mount routes) — mount `/api/wc-pickem`

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/wc-pickem/settings` | Lấy `wc_settings` của guild |
| PUT | `/api/wc-pickem/settings` | Update channel_id, enabled, bracket_lock_at |
| GET | `/api/wc-pickem/prizes?game=pickem\|bracket` | List prizes |
| PUT | `/api/wc-pickem/prizes` | Upsert prize tier (top1/top3/top10) |
| POST | `/api/wc-pickem/prizes/image` | Upload ảnh giải thưởng (multipart, lưu vào `dashboard/public/uploads/`) |
| GET | `/api/wc-pickem/leaderboard?game=pickem\|bracket\|total&limit=50` | Leaderboard |
| GET | `/api/wc-pickem/matches/upcoming` | Lịch trận sắp đá (preview cho admin) |
| PUT | `/api/wc-pickem/matches/:matchId/override` | Admin override result (Phase 09) |

## UI Sections (tab `wc-2026.html`)

1. **Cấu hình** — chọn channel post Pick'em + toggle enable + nút "Sync fixture ngay"
2. **Giải thưởng Pick'em** — 3 card top1/top3/top10, mỗi card: title input + textarea description + upload ảnh + preview
3. **Giải thưởng Bracket** — tương tự
4. **Leaderboard** — tabs (Pick'em / Bracket / Tổng) + table top 50
5. **Lịch trận** — danh sách 64 trận, status, có thể trigger override (Phase 09)

## Todo

- [ ] **Load `.claude/skills/dashboard-layout/SKILL.md`** trước khi viết HTML
- [ ] Tạo `wc-2026.html` theo template standalone (xem `honor-config.html`)
- [ ] Tạo `wc-pickem.js` routes với JWT auth (theo pattern `honor.js`)
- [ ] Add image upload endpoint (dùng `multer` nếu đã có; lưu vào `dashboard/public/uploads/wc-prizes/`)
- [ ] Add nav item vào sidebar + register tab trong Alpine.js
- [ ] Leaderboard query reuse `getLeaderboard()` helper từ Phase 01
- [ ] Form prizes có markdown preview (reuse marked.js nếu đã có)

## Success Criteria

- Tab WC 2026 hiển thị trong sidebar
- Toggle enable + chọn channel hoạt động
- Upload ảnh thành công, hiển thị preview
- Leaderboard render đúng top 50
- API auth qua JWT, 401 redirect login

## Risks

- Upload ảnh: cần check kích thước (giới hạn 2MB) + extension whitelist
- Markdown XSS: sanitize description trước render trong Discord embed
- Schema breakage nếu Phase 01 chưa xong → block plan này
