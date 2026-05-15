# Phase 06 — `/post-delete` Ownership + Cleanup

**Priority:** Medium
**Status:** pending
**Depends on:** Phase 04

## Overview
Member xóa bài của mình. Bot xóa thread public (nếu có), xóa message review, mark DB status='deleted' (giữ row cho audit).

## Related Files
- **New:** `bot/src/commands/post-delete.js`
- **Edit:** `bot/src/services/post-service.js`

## Command Spec
```
/post-delete post_id:<autocomplete>
```
Autocomplete reuse logic từ Phase 05 (statuses=['pending','approved']).

## Flow
```
/post-delete (chọn)
  → Confirm ephemeral với button [Xóa] [Hủy]
  → Click Xóa:
     • Verify ownership
     • Nếu public_thread_id: thread.delete().catch(noop)
     • Nếu review_message_id: msg.delete().catch(noop)
     • UPDATE posts SET status='deleted', updated_at
     • Reply ephemeral "Đã xóa"
```

## Implementation Steps
1. `commands/post-delete.js` với autocomplete
2. Execute: show ephemeral confirm với buttons `post:delete-confirm:<id>` / `post:delete-cancel:<id>`
3. Button handler trong interaction-create.js
4. `deletePost()` service
5. Test: delete approved → cả thread + review msg đều đi
6. Test: delete pending → chỉ review msg đi
7. Admin override: nếu user có ManageMessages → cho phép xóa bài của người khác (optional, có thể skip MVP)

## Todo
- [ ] `commands/post-delete.js` + autocomplete
- [ ] Ephemeral confirm button flow
- [ ] Delete confirm/cancel button dispatcher
- [ ] `deletePost()` service
- [ ] Ownership guard
- [ ] Test E2E pending delete
- [ ] Test E2E approved delete

## Success Criteria
- User không xóa được bài người khác
- Cleanup sạch cả thread + review message
- DB row vẫn còn với status='deleted'

## Risks
- Thread hoặc message bị xóa tay từ trước → catch + proceed
