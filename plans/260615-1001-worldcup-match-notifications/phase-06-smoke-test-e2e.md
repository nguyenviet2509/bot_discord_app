# Phase 06 — Smoke Test E2E + Edge Cases

## Context

- Manual test trên Discord server thật (hoặc test server riêng).
- Mục tiêu: verify happy path + 4 edge case quan trọng.

## Overview

- Priority: P1
- Status: pending
- Không viết unit test mới (KISS — project hiện chưa có test infra cho bot). Smoke test thủ công + checklist.

## Test scenarios

### S1 — Happy path
1. Login dashboard owner, tab Worldcup, tạo match `Brazil vs Argentina`, kick_off = `now + 2 phút` (set để test nhanh, không cần đợi 30p).
2. Login dashboard guild admin, bật config: channel = #test, N = 1, role ping = (none), tz = Asia/Saigon.
3. Đợi đến phút thứ 1 trước kick-off → tin embed xuất hiện.

**Expect:** đúng format embed, đúng cờ, đúng giờ local.

### S2 — Idempotent (restart)
1. Setup giống S1, N=2.
2. Sau khi gửi xong, restart bot.
3. Trong window catch-up, verify **không gửi lại**.

**Expect:** notification_log đã ghi, catch-up skip.

### S3 — Postpone (re-schedule)
1. Tạo match kick_off = `now + 35p`, N=30.
2. Trước phút 30 còn 10p, dashboard owner edit kick_off = `now + 90p`.
3. Verify ở phút 30 cũ (now+5p) **không gửi**.
4. Verify ở phút 30 mới (now+60p) **có gửi**.

**Expect:** scheduler query realtime nên auto re-schedule.

### S4 — Disable
1. Setup gửi sắp tới.
2. Disable guild config 5 phút trước.
3. **Không có tin gửi.**

### S5 — Multi-guild different N
1. Guild A: N=30. Guild B: N=10.
2. 1 match kick_off `now + 35p`.
3. Phút 30 trước trận → chỉ guild A nhận.
4. Phút 10 trước trận → chỉ guild B nhận.

### S6 — Delete match
1. Tạo match có notification_log (đã gửi).
2. Delete match qua dashboard.
3. Verify row trong `worldcup_notification_log` cũng bị xoá.

### S7 — Permission
1. User không có owner role → gọi `/api/worldcup/matches` POST → 403.
2. Non-guild-admin → gọi `/api/guilds/:id/worldcup-config` PATCH → 403.

## Todo

- [ ] Chạy S1
- [ ] Chạy S2
- [ ] Chạy S3
- [ ] Chạy S4
- [ ] Chạy S5 (cần 2 guild)
- [ ] Chạy S6
- [ ] Chạy S7
- [ ] Document bug fix nếu có

## Success criteria

- Tất cả 7 scenario pass.
- Không spam log lỗi.
- DB không có row mồ côi.

## Risks

- Nếu thiếu test server thứ 2 cho S5 → skip, note vào report.

## Next

Plan complete → archive + journal. Có thể nghĩ tiếp:
- Import lịch JSON bulk.
- Slash command `/worldcup-next` xem trận sắp tới.
- Lưu kết quả + thông báo sau trận.
- Filter theo đội yêu thích.
