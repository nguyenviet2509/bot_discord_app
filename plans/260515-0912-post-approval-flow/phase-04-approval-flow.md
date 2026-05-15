# Phase 04 — Interaction Handler Refactor + Approval

**Priority:** Critical
**Status:** pending
**Depends on:** Phase 03

## Overview
Tách `interactionCreate` khỏi `index.js` thành `events/interaction-create.js`. Add dispatch: slash / modal / button. Implement approve/reject flow.

## Related Files
- **New:** `bot/src/events/interaction-create.js`
- **Edit:** `bot/src/index.js` (gỡ handler inline)
- **Edit:** `bot/src/services/post-service.js` (thêm approve/reject)

## Dispatcher Pattern
```js
// events/interaction-create.js
module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) return handleSlashCommand(interaction, client)
    if (interaction.isModalSubmit())       return handleModalSubmit(interaction, client)
    if (interaction.isButton())            return handleButton(interaction, client)
    if (interaction.isAutocomplete())      return handleAutocomplete(interaction, client)
  }
}

// Dispatch by customId prefix
// post:create-modal       → post-service.createPendingPost
// post:reject-modal:<id>  → post-service.rejectPost (với reason từ field)
// post:edit-modal:<id>    → (phase 05)
// post:approve:<id>       → post-service.approvePost
// post:reject:<id>        → show reject modal
```

## Service Methods
```js
approvePost(client, interaction, postId) {
  // 1. Lock: SELECT post → check status='pending', else reply "đã xử lý"
  // 2. Check admin role: member roles ∩ settings.post_admin_role_ids
  // 3. forumChannel.threads.create({ name: post.title, message: { embeds: [approvedEmbed] } })
  // 4. db.updatePostStatus(id, { status: 'approved', approver_*, public_thread_id, reviewed_at })
  // 5. Edit review message: components=[], embed footer updated
  // 6. DM author: "Bài approved, link: ..."
}

rejectPost(client, interaction, postId, reason) {
  // 1. Lock check pending
  // 2. Admin role check
  // 3. db.updatePostStatus(id, { status:'rejected', reject_reason, approver_*, reviewed_at })
  // 4. Edit review msg: remove buttons, footer "❌ Rejected: <reason> by @admin"
  // 5. DM author with reason
}
```

## Reject Modal (`post:reject-modal:<id>`)
1 field: `reason` (Paragraph, required, maxLength 500)

## Implementation Steps
1. Tạo `events/interaction-create.js` skeleton với 4 dispatchers
2. Move slash command logic từ `index.js` sang `handleSlashCommand`
3. Move modal handler tạm bợ từ Phase 03 sang `handleModalSubmit`
4. Implement `handleButton` dispatch: parse `customId.split(':')`
5. Implement `approvePost()` trong service
6. Implement `rejectPost()` + reject modal flow
7. Cleanup `index.js`: chỉ giữ event loader
8. Test idempotency: click 2 lần → lần 2 reply "đã xử lý"

## Todo
- [ ] `events/interaction-create.js` với 4 dispatchers
- [ ] Migrate slash handler từ index.js
- [ ] Migrate modal create handler
- [ ] Button dispatcher với prefix parsing
- [ ] `approvePost()` service
- [ ] `rejectPost()` service + show reject modal khi click ❌
- [ ] Reject modal submit handler
- [ ] Idempotency check (status='pending' guard)
- [ ] Admin role check helper
- [ ] Cleanup index.js
- [ ] Test E2E: post → approve → thread trong forum
- [ ] Test E2E: post → reject với reason → DM member

## Success Criteria
- `bot/src/index.js` không còn inline interaction handler
- Click Duyệt → forum thread tạo đúng, message review update, DM gửi
- Click Từ chối → modal hiện, submit → status rejected + DM kèm reason
- Double-click không tạo duplicate thread

## Risks
- Race condition double-click: dùng SQLite transaction `SELECT...WHERE status='pending'` rồi UPDATE — better-sqlite3 sync nên safe trong single-process
- forum.threads.create fail (permission) → rollback DB? KISS: log error, reply admin "tạo thread fail", giữ status pending để admin retry
