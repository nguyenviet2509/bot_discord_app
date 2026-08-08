# Phase 4 — Test thực tế + tinh chỉnh

**Status:** pending
**Effort:** 0.5 ngày
**Priority:** P1 (sau khi P1-P3 xong)

## Overview

Test trên server thật, fix edge cases lộ ra. Viết docs admin guide.

## Test cases

### Golden path
1. Bật module qua dashboard, thêm từ "abc" → user gửi "abc xyz" → tin bị xoá → webhook repost "*** xyz" với tên + avatar user gốc.
2. Tin nhiều match: "abc abc def" → "*** *** def".
3. Case-insensitive: "ABC", "AbC", "abc" đều match.
4. Word boundary: từ "abc" không match "abcdef" hay "xabc".

### Edge cases
5. **Loop prevention:** webhook message (chính bot vừa repost) không trigger handler lại.
6. **Race auto-mod:** bật cả `auto-mod` bad-word + `word-filter` cùng từ → tin bị auto-mod xoá trước → word-filter catch 10008 im lặng, không log error.
7. **Thread channel:** test trong thread → webhook repost trong đúng thread.
8. **DM:** bot không xử lý tin DM (early return).
9. **Mention:** tin chứa "@everyone abc" → webhook repost "@everyone ***" KHÔNG re-ping (vì `allowedMentions: { parse: [] }`).
10. **Reply:** user reply tin khác kèm từ cấm → webhook repost prepend "↪ (trả lời)" + masked content.
11. **Attachment:** tin có ảnh + từ cấm → MVP: ảnh mất, chỉ text repost. Document limitation.
12. **Empty content** (chỉ có attachment): regex không match → bỏ qua.
13. **Thiếu perm `Manage Webhooks`:** log warn 1 lần/guild/giờ, tin chỉ bị xoá.
14. **Thiếu perm `Manage Messages`:** delete fail → log + không repost (tránh duplicate).
15. **Long content** (gần 2000 char limit Discord): mask vẫn fit (vì `***` ngắn hơn từ gốc).
16. **Bot member khác trong server** (manage-bot khác): tin của bot → skip (`author.bot`).

### Performance
17. Latency p95 delete+repost: < 500ms (đo qua console.time trong handler).
18. 100 tin liên tiếp chứa từ cấm: không crash, không leak memory webhook cache.

## Docs

Tạo `docs/word-filter-guide.md` ngắn gọn (~50 dòng):
- Bật module
- Thêm từ qua dashboard
- Cách hoạt động (xoá + repost webhook)
- Hạn chế (badge APP, mất role color, mất reply UI, mất attachment, không cover edit, không normalize unicode)
- Perm bot cần: `Manage Webhooks` + `Manage Messages`
- Troubleshoot table

## Related files

**Create:**
- `docs/word-filter-guide.md`

**Modify (nếu test lộ bug):**
- Files đã tạo ở Phase 2-3

## Todo

- [ ] Chạy 18 test case ở trên trên test server
- [ ] Ghi lại bugs gặp phải + fix
- [ ] Đo latency 100 tin sample
- [ ] Viết `docs/word-filter-guide.md`
- [ ] Update `docs/codebase-summary.md` (nếu có) thêm reference module mới

## Success criteria

- 18/18 test pass
- Không crash sau 100 tin
- Docs admin guide đầy đủ troubleshoot section

## Risks

- Test server không đủ traffic để stress test → chấp nhận, real production sẽ catch.

## Next

→ Hoàn thành plan, cập nhật roadmap nếu cần. Auto-commit + push theo rule `.claude/rules/auto-commit-push.md`.
