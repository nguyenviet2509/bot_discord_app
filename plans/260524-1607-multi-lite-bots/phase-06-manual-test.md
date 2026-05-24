# Phase 06: Manual Test + Polish

**Status:** pending | **Effort:** 1.5h | **Priority:** high
**Depends on:** Phase 01-05

## Context
Validate end-to-end với 2-3 bot Discord thật. User cần tạo trước Discord application ở Developer Portal.

## Prerequisites
- User tạo 2-3 Discord application ở Developer Portal
- Mỗi bot có token (copy ra file riêng, KHÔNG commit)
- Mỗi bot invite vào server test với OAuth URL (scope `bot`, permissions tối thiểu)

## Test Matrix
| # | Scenario | Expected |
|---|----------|----------|
| 1 | Boot process, mở dashboard | Tab "Quản lý Bot" hiển thị, list rỗng |
| 2 | Add bot 1 với token invalid | Toast lỗi "Invalid Discord token", không insert DB |
| 3 | Add bot 1 với token valid + tên "Mèo Mun" | Card xuất hiện, status=stopped |
| 4 | Upload avatar PNG 100KB | Preview update, DB lưu URL |
| 5 | Set activity_type=Playing, text="Genshin" | DB cập nhật |
| 6 | Bấm Start | Bot online trong Discord ≤5s, tên "Mèo Mun", avatar đúng, status "Đang chơi Genshin" |
| 7 | Edit activity_text="Liên Quân" khi running | Discord cập nhật ≤3s, không cần restart |
| 8 | Đổi display_name khi running | Discord username đổi, last_username_change cập nhật |
| 9 | Cố đổi tên lại trong 30 phút | Button disable, tooltip giải thích |
| 10 | Add bot 2 + Start | Cả 2 bot online song song |
| 11 | Stop bot 1 | Bot 1 offline ≤2s, bot 2 vẫn online |
| 12 | Kill BossBabel manually (giả lập crash) | Lite bot không ảnh hưởng (note: cùng process nên thực ra cùng chết — chỉ test xem manager crash 1 client có ảnh hưởng client khác không) |
| 13 | Ctrl+C process | Cả lite bot + BossBabel stop sạch |
| 14 | Restart process | Tất cả lite bot về stopped (lazy), BossBabel chạy lại |
| 15 | Delete bot 1 | Row xoá, file avatar xoá, không còn trong member list |
| 16 | Mobile dashboard (DevTools 375px) | Card stack OK, button không tràn |

## Polish Items
- Toast notification cho mọi action (success/error)
- Loading state khi start/stop (button spinner)
- Empty state khi chưa có bot ("Bấm + Thêm bot để bắt đầu")
- Tooltip cho rate limit guard
- BossBabel vẫn chạy ổn định suốt test session

## Todo
- [ ] User tạo 2-3 Discord app + token
- [ ] Chạy test matrix
- [ ] Fix bug phát hiện
- [ ] Polish UI states
- [ ] Verify ciphertext trong DB: `sqlite3 database.sqlite "SELECT discord_token FROM managed_bots LIMIT 1"`
- [ ] Verify BossBabel logs không có error

## Success Criteria
- Tất cả 16 scenario PASS
- BossBabel không restart, không error trong suốt test
- Token DB là ciphertext base64, không plain
- Mobile UI usable

## Risks
- `ActivityType.Custom` không hiển thị → fallback Playing đã có ở phase 02
- Rate limit thật từ Discord khi test nhanh → đợi 30 phút giữa các lần đổi name
- Token vô tình commit → kiểm `git status` trước commit, dùng `.env.local` hoặc dashboard input (không lưu file)

## Definition of Done
- Test matrix PASS hết
- Code commit theo `auto-commit-push.md` rule (feat: multi lite bots management)
- plan.md update status=completed

## Next
- v2 ideas: audit log, auto_start flag, OAuth invite URL helper, scheduled activity rotation
