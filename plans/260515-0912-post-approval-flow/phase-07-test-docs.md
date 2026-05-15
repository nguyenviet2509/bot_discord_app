# Phase 07 — Integration Test + Docs Update

**Priority:** Medium
**Status:** pending
**Depends on:** Phase 01-06

## Overview
Manual E2E test trên Discord server thật. Update docs.

## Related Files
- **Edit:** `docs/codebase-summary.md` (nếu có)
- **Edit:** `docs/system-architecture.md` (nếu có)
- **Edit:** `docs/project-changelog.md`
- **New:** `docs/post-approval-feature.md` (user guide ngắn)
- **Edit:** `README.md` (1 dòng feature list)

## E2E Test Matrix
| # | Scenario | Expected |
|---|---|---|
| 1 | Admin `/post-setup` với channel sai type | Reply ephemeral lỗi |
| 2 | Admin setup đúng, `/post-setup show` | Hiện đủ 3 config |
| 3 | Member `/post` chưa setup | Reply "admin chưa cấu hình" |
| 4 | Member `/post` → submit modal | Message hiện #review + DM |
| 5 | Admin click Duyệt | Forum thread tạo, msg update, DM gửi |
| 6 | Admin click Từ chối → submit reason | Status rejected, DM kèm reason |
| 7 | Admin double-click Duyệt | Lần 2 reply "đã xử lý" |
| 8 | Member `/post-edit` bài pending | Modal pre-filled, submit → msg #review update |
| 9 | Member `/post-edit` bài approved | Thread cũ biến mất, msg mới #review |
| 10 | Member `/post-edit` bài người khác | Autocomplete không hiện |
| 11 | Member `/post-delete` approved | Thread + msg #review xóa, DB status=deleted |
| 12 | Non-admin click Duyệt | Reply "không có quyền" |
| 13 | Restart bot giữa pending | Click Duyệt vẫn hoạt động (state từ DB) |

## Docs Updates
- `project-changelog.md`: thêm entry "Post Approval Flow"
- `system-architecture.md`: thêm section "Post moderation" với diagram
- `post-approval-feature.md`: user guide ngắn gọn (admin setup + member commands)

## Implementation Steps
1. Chạy bot local
2. Setup test guild với #review (text) + #public (forum) + admin role
3. Chạy qua 13 scenarios, ghi log fail
4. Fix bug nếu có
5. Update docs
6. Commit theo conventional commits format

## Todo
- [ ] Chạy 13 test scenarios
- [ ] Fix bug phát hiện
- [ ] Update changelog
- [ ] Update system-architecture
- [ ] Viết user guide
- [ ] Update README
- [ ] Commit + push

## Success Criteria
- 13/13 scenarios pass
- Docs đồng bộ với code
- No `console.error` log trong happy path
