---
phase: 5
title: "Manual verification"
status: pending
priority: P2
effort: "30m"
dependencies: [2, 3, 4]
---

# Phase 5: Manual verification

## Overview

Test end-to-end trong Discord server thật + dashboard chạy local. Không có automated test (codebase chưa có test framework cho bot events).

## Requirements

- Bot online, dashboard online, có quyền admin vào dashboard
- Server Discord có ≥ 2 voice channels test (vd "Voice 1", "Voice 2")
- 1 text channel để nhận notify (vd "voice-log")
- 1 tài khoản Discord khác (alt account hoặc bạn) để join voice test

## Implementation Steps

### Setup
1. Khởi động bot: `npm run bot` → đợi log `[Bot] ✅ Ready!`
2. Khởi động dashboard: `npm run dashboard` → mở `http://localhost:3001`, login

### Test 1: Default state (disabled)
3. Vào tab "Theo dõi voice", kiểm tra: toggle OFF, watched_channels rỗng, template mặc định tiếng Việt
4. Join voice trong server → text channel notify KHÔNG có message ✓

### Test 2: Enable + whitelist
5. Trong dashboard: bật toggle, chọn notify channel = "voice-log", tick "Voice 1", bấm Lưu → toast xanh
6. Tài khoản test join "Voice 1" → trong "voice-log" xuất hiện: `🔊 @user vừa vào **Voice 1** lúc HH:mm`
7. Tài khoản test rời "Voice 1" → `👋 username đã rời **Voice 1** lúc HH:mm`

### Test 3: Out-of-whitelist im lặng
8. Tài khoản test join "Voice 2" (không trong whitelist) → "voice-log" KHÔNG có message ✓

### Test 4: Switch behavior
9. Tick cả "Voice 1" và "Voice 2", Lưu
10. Tài khoản test join "Voice 1" → 1 message join
11. Tài khoản test switch sang "Voice 2" → 2 message liên tiếp: leave Voice 1 + join Voice 2
12. Tick chỉ "Voice 1" (bỏ Voice 2), Lưu
13. Tài khoản test ở "Voice 1", switch sang "Voice 2" → CHỈ 1 message leave Voice 1
14. Switch ngược lại Voice 2 → Voice 1 → CHỈ 1 message join Voice 1

### Test 5: Bot account im lặng
15. Bot tự join voice channel (nếu có command, hoặc skip nếu không) → KHÔNG có message ✓

### Test 6: Placeholder replacement
16. Đổi template join thành: `[TEST] user={user} name={username} ch={channel} t={time}`, Lưu
17. Join "Voice 1" → message render đúng cả 4 placeholder (mention đúng id, username text, channel name, giờ HH:mm theo TZ VN)

### Test 7: Mute/Deafen skip
18. Trong voice channel, self-mute → KHÔNG có message ✓ (oldCh === newCh)

### Test 8: Persistence
19. F5 reload dashboard → form giữ nguyên cấu hình đã lưu ✓

### Test 9: Validation
20. Xóa join_template, bấm Lưu → toast đỏ "Mẫu tin nhắn JOIN không được rỗng"

### Test 10: Restart safety
21. Ctrl+C bot, khởi động lại → cấu hình vẫn còn, function vẫn hoạt động

## Success Criteria

- [ ] Tất cả 10 test pass
- [ ] Không có console error trong bot log hoặc dashboard
- [ ] Không có Discord API rate limit warning trong log
- [ ] DB file vẫn integrity (chạy `sqlite3 database.sqlite "PRAGMA integrity_check"` → "ok")

## Risk Assessment

- **Risk**: Discord cache lag → channel name có thể stale 1-2s sau khi rename. Chấp nhận.
- **Risk**: Test trên 1 guild duy nhất, không cover multi-guild. Hiện tại bot chỉ deploy cho 1 GUILD_ID nên không phải concern.

## Post-Phase

Sau khi 5 phase pass:
- Theo `.claude/rules/auto-commit-push.md`: tự động commit + push lên master với message conventional `feat: voice in/out notification + dashboard config`
- Update docs nếu cần (kiểm tra `docs/` xem có file nào liên quan voice/dashboard tabs để cập nhật)
