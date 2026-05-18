# Phase 6 — Test thực tế + Tinh chỉnh

**Priority:** P1
**Status:** pending
**Effort:** 1-2 ngày
**Depends on:** Phase 1-5

## Overview
Triển khai lên test server, theo dõi log 3-7 ngày, tinh chỉnh threshold, fix false positive, viết doc hướng dẫn admin.

## Test scenarios

| Scenario | Expected |
|---|---|
| User spam 5 tin trong 5s | Tin thứ 5 bị xóa, warn DM |
| User spam tiếp | Mute 5 phút ở vi phạm 2 |
| User gửi `discord.gg/xxx` | Xóa ngay |
| User gửi từ trong bad-word list | Xóa ngay |
| User @everyone (mass-mention) | Xóa nếu >5 mention |
| User lặp 3 lần cùng tin | Xóa ở lần 3 |
| Admin role gửi spam | KHÔNG bị check (whitelist) |
| Channel #bot-spam gửi spam | KHÔNG bị check (whitelist) |
| User vi phạm rồi sau 24h | Warn reset, lại bắt đầu từ vi phạm 1 |
| Bot không có quyền timeout | Tin vẫn bị xóa, log warn "no permission" |
| User tắt DM | Fallback ephemeral channel hoạt động |

## Performance test
- Gửi 1000 tin trong 10 phút → check:
  - Latency message-create < 100ms (P95)
  - Memory không tăng vô hạn (state cleanup hoạt động)
  - DB không lock (better-sqlite3 sync mode OK)

## Tuning checklist
- [ ] False positive ratio < 2% sau 3 ngày → nếu cao, raise threshold
- [ ] Top vi phạm rule có hợp lý không (anti-spam expected cao nhất)
- [ ] Admin feedback: rule nào quá gắt, rule nào quá lỏng
- [ ] Logs có đầy đủ context để review không (excerpt đủ dài?)
- [ ] DM warn message có rõ ràng không

## Doc deliverables
- **Tạo:** `docs/auto-mod-guide.md` — hướng dẫn admin
  - Cách bật/tắt rule
  - Giải thích từng rule + threshold đề xuất
  - Cách thêm bad-word
  - Cách review log + clear warn
  - Troubleshoot (bot không xóa, DM fail, etc.)

## Bug bash
Mời 2-3 user test:
- Cố tình spam → kiểm tra UX warn DM có khó chịu không
- Test edge case: tin có 4 mention (boundary), 5 mention (trigger)
- Test bypass: zero-width char trong bad-word → ghi nhận bypass, schedule phase 2

## Todo
- [ ] Deploy lên test server
- [ ] Chạy 11 test scenario manual
- [ ] Performance test 1000 tin
- [ ] Mời user bug bash
- [ ] Tune threshold dựa log thực tế
- [ ] Viết `docs/auto-mod-guide.md`
- [ ] Update `docs/codebase-summary.md` thêm module auto-mod

## Success criteria
- 11/11 test scenario pass
- False positive < 2%
- Performance P95 < 100ms
- Doc đầy đủ cho admin tự cấu hình

## Risks
- **Test server không có traffic thật:** Coi như smoke test, theo dõi 1 tuần đầu trên prod
- **User không phối hợp bug bash:** Tự test offline với 2 account, đủ cho MVP

## Next phase (out of scope)
- Appeal flow
- Anti-raid (join velocity)
- Unicode normalization (chống zero-width bypass)
- Tích hợp honor system (vi phạm trừ điểm)
- AI moderation (nếu sau này gỡ ràng buộc "không tích hợp ngoài")
