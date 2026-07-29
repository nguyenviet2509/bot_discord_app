# Phase 06: Integration Test & Docs

**Priority:** Medium | **Status:** pending
**Depends on:** Phase 01-05

## Overview
End-to-end test flow trên môi trường dev + update docs.

## Test scenarios

### DB
- [ ] Chạy bot fresh DB → 4 bảng blesscastle_* tạo OK
- [ ] Re-run → không lỗi (IF NOT EXISTS)

### Voice tracker
- [ ] Config guild với 1 voice channel BC, min_minutes=1 (để test nhanh)
- [ ] Join voice ngoài khung Fri 20-21h → không cộng seconds
- [ ] Join voice trong khung Fri 20-21h (mock system time hoặc test trực tiếp) → voice_seconds tăng
- [ ] Leave/rejoin cùng phiên → cộng dồn OK
- [ ] Move sang non-BC channel → dừng đếm

### Weekly cron
- [ ] Manually invoke `finalizeWeek()` với data mock → user đạt +1 sao, finalized=1
- [ ] User không đạt → stars không đổi

### Discord commands
- [ ] `/bc-stars` — user 0 sao hiển thị 0
- [ ] `/bc-stars` — user có sao hiển thị đúng progress
- [ ] `/bc-stars @otherUser` — xem user khác
- [ ] `/bc-leaderboard` — top 10 sort đúng

### Member lifecycle
- [ ] Kick user → deleted_at set
- [ ] Re-invite trong 7 ngày → restore
- [ ] Cleanup cron mock (now > 7 ngày) → xóa hết record của user đó

### Dashboard
- [ ] Login → mở tab BlessCastle
- [ ] Config save + reload persist
- [ ] Members list load
- [ ] Manual tick / untick
- [ ] Sau 19h thứ 6 → nút manual tick disabled (client + server 400)
- [ ] Redeem stars < 3 → nút disabled + server 400
- [ ] Redeem stars >= 3 → success, stars=0, xuất hiện history

### Redemption history
- [ ] Load OK, format ngày đẹp
- [ ] Sort DESC by redeemed_at

## Docs update
- [ ] `docs/system-architecture.md` — thêm section BlessCastle module
- [ ] `docs/project-changelog.md` — entry `feat: BlessCastle management`
- [ ] Không tạo docs mới nếu không cần

## Todo
- [ ] Chạy tất cả scenarios trên
- [ ] Fix bug phát sinh
- [ ] Update docs
- [ ] Commit + push theo `.claude/rules/auto-commit-push.md`

## Success Criteria
- Tất cả scenarios pass
- Không regression các feature khác (level, honor, voice-stats, automod)
- Docs updated
- Code review PR OK (delegate `code-reviewer`)
