# Brainstorm Report: Auto-remove thành viên đã rời nhóm

**Date:** 2026-06-18
**Scope:** Phần thống kê EXP thành viên — tự động xóa user khi rời guild.

## Problem

Tab Thành viên (dashboard XP leaderboard) hiển thị cả user đã rời server vì:
- `guildMemberRemove` event chỉ log vào `member_events`, không xóa `users` table.
- Route `dashboard/routes/members.js` trả về toàn bộ `db.getAllUsers(guildId)` không filter.
- Analytics header (108 / 1.228.521 / 64) compute client-side từ array members → kế thừa lỗi.

## Approaches đã đánh giá

| # | Approach | Pros | Cons |
|---|----------|------|------|
| 1 | Hard delete ngay khi event | Simple, sạch DB | Mất XP nếu rejoin; fragile khi bot offline |
| 2 | Soft filter qua Discord API sync | Preserve data, handle offline | DB phình to với user cũ |
| 3 | Soft delete + cleanup N ngày | Linh hoạt nhất | Code phức tạp, overkill cho scope hiện tại |
| 4 | **Hybrid: hard delete event + reconcile API** | Cover cả online & offline case | Cần 2 code path |

## Quyết định

**Approach 4** với policy hard delete (user xác nhận):
- Lớp 1: `guildMemberRemove` event → delete ngay khi bot online.
- Lớp 2: Reconcile khi mở tab (Members + Voice stats) → cross-check Discord API → xóa user "ghost".

## Rationale

- KISS: tận dụng `fetchDiscordMembers` đã có trong members route.
- YAGNI: không cần job scheduler riêng — reconcile khi user mở dashboard là đủ.
- Guild 108 user, dư sức Discord API limit 1000/req.
- Analytics tổng tự động đúng vì client compute từ filtered list.

## Scope áp dụng

- Tab Thành viên (XP leaderboard) ✅
- Voice stats leaderboard ✅
- Analytics header tổng (tổng thành viên, tổng XP, level max) ✅ (tự động)
- Honor/vinh danh ❌ (user không chọn)

## Files thay đổi

- `bot/src/events/guild-member-remove.js` — thêm delete calls
- `dashboard/routes/members.js` — reconcile sau Discord API fetch
- `dashboard/routes/voice-stats.js` — reconcile riêng (đảm bảo consistent khi user vào thẳng tab voice)
- `shared/db-voice-stats.js` — thêm hàm `deleteVoiceStats`

## Risks

- Discord API fail → reconcile skip (giữ data, không xóa nhầm). Guard `members.length > 0`.
- Rejoin sau xóa → bắt đầu lại từ 0 (policy đã xác nhận).

## Unresolved

None.
