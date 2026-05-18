# Phase 7 — Testing + Deploy Commands

**Priority:** P0 (cuối cùng nhưng bắt buộc)
**Status:** pending
**Effort:** S (~30 min)
**Depends on:** Phase 1-6

## Overview
Smoke test end-to-end + chạy deploy commands để register slash command mới với Discord.

## Related files
- **Run:** `bot/src/deploy-commands.js` (auto pickup file mới trong `commands/`)

## Test checklist

### Database
- [ ] Restart bot/dashboard → 2 bảng tự tạo qua `initDb()`
- [ ] Query manually: `SELECT * FROM honor_settings; SELECT * FROM honor_history;` đều OK

### Dashboard
- [ ] Mở `honor-config.html` → load roles + settings OK
- [ ] Save 1 role → reload → role giữ nguyên
- [ ] Mở `honor-preview.html` → nhập data → preview render đúng
- [ ] History table empty ban đầu, sau khi gửi vinh danh có record

### Bot — Happy path
- [ ] User có role được cấp quyền gõ `/vinhdanh user1:@a user2:@b user3:@c banner:[image]`
- [ ] Modal hiện với 4 input
- [ ] Submit modal → embed Champion Spotlight xuất hiện trong channel target
- [ ] Mention 3 user trong content message
- [ ] Bot react 🎉 và 👏
- [ ] Record xuất hiện trong `honor_history` với `message_id` đúng

### Bot — Edge cases
- [ ] User không có role → reply "🚫 Bạn không có quyền dùng lệnh này" (ephemeral)
- [ ] 3 user trùng (user1 = user2) → reply error rõ ràng
- [ ] Banner không phải image → reply error
- [ ] Modal timeout (chờ > 5 phút submit) → pending entry tự xoá, gửi ephemeral "Đã hết hạn, vui lòng gõ lại lệnh"
- [ ] Reason chứa `**bold**` → render plain text, không bị bold

### Bot — History
- [ ] `/vinhdanh-history` sau 0 record → "Chưa có lần vinh danh nào"
- [ ] Sau 1+ record → list đúng, link mở message gốc

## Deploy steps
1. Đảm bảo `.env` có `BOT_TOKEN`, `CLIENT_ID`, `GUILD_ID`
2. Chạy `node bot/src/deploy-commands.js`
3. Verify: `[Deploy] ✅ Successfully registered N command(s).` với N tăng thêm 2
4. Discord client: gõ `/` trong server → thấy `/vinhdanh` và `/vinhdanh-history`

## Todo
- [ ] Restart bot/dashboard verify migration
- [ ] Run deploy-commands.js
- [ ] Test happy path end-to-end
- [ ] Test 5 edge cases trên
- [ ] Test history command
- [ ] Document trong docs/codebase-summary.md (nếu có)

## Success criteria
- Tất cả test trên pass
- Không có error log khi gửi vinh danh
- 2 command mới xuất hiện trong Discord
