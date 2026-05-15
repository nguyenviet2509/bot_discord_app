# Phase 05 — `/post-edit` Re-Review Flow

**Priority:** Medium
**Status:** pending
**Depends on:** Phase 04

## Overview
Member chỉnh bài của mình. Edit nội dung → bài về pending, thread public bị xóa, repost vào #review.

## Related Files
- **New:** `bot/src/commands/post-edit.js`
- **Edit:** `bot/src/services/post-service.js`
- **Edit:** `bot/src/events/interaction-create.js` (autocomplete + edit modal dispatch)

## Command Spec
```
/post-edit post_id:<autocomplete>
```
Autocomplete: lấy `getPostsByAuthor(guild, member, ['pending','approved'])` → trả 25 option dạng `#<id> · <title.slice(0,50)>`

## Flow
```
/post-edit (chọn từ autocomplete)
  → Modal pre-filled (title, content, price, contact từ DB)
  → Submit
  → service.editPost():
      • Validate ownership (post.author_id === member.id)
      • UPDATE posts SET title, content, price, contact, status='pending', updated_at
      • Nếu post.public_thread_id: thread.delete() (catch errors)
      • Repost vào #review với embed mới + buttons
      • Update review_message_id mới
      • DM member: "Bài đã sửa, chờ duyệt lại"
```

## Implementation Steps
1. `commands/post-edit.js` với autocomplete option
2. Autocomplete handler trong `interaction-create.js`
3. Execute: fetch post từ DB → build modal pre-filled với `customId: post:edit-modal:<id>`
4. Modal submit handler → `service.editPost()`
5. `editPost()` trong service: thực hiện 6 bước trên
6. Test: edit pending → review msg update tại chỗ (KHÔNG tạo message mới)
7. Test: edit approved → thread cũ xóa + message mới trong #review

## Todo
- [ ] `commands/post-edit.js` với autocomplete
- [ ] Autocomplete dispatcher trong interaction-create.js
- [ ] Show pre-filled modal
- [ ] Modal submit handler `post:edit-modal:<id>`
- [ ] `editPost()` service với 2 nhánh (pending: edit msg / approved: delete thread + repost)
- [ ] Ownership guard
- [ ] DM notification
- [ ] Test E2E pending edit
- [ ] Test E2E approved edit

## Success Criteria
- Member chỉ thấy bài của mình trong autocomplete
- Edit pending → message #review update content
- Edit approved → thread public biến mất, message mới hiện trong #review với buttons
- Status DB về pending

## Risks
- Thread.delete() fail (đã bị xóa tay) → catch, vẫn proceed
- Edit liên tục → spam: chấp nhận MVP, có thể rate-limit sau
