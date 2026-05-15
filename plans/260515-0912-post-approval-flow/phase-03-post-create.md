# Phase 03 — `/post` Create Flow + Embed Util

**Priority:** Critical
**Status:** pending
**Depends on:** Phase 01, 02

## Overview
Member chạy `/post` → bot show modal → submit → bot tạo embed + buttons post vào #review → DB ghi pending.

## Related Files
- **New:** `bot/src/commands/post.js`
- **New:** `bot/src/utils/post-embed.js`
- **New:** `bot/src/services/post-service.js`

## Component Spec

### Modal `post:create-modal`
| Field | customId | Style | Required | maxLength |
|---|---|---|---|---|
| Tiêu đề | title | Short | yes | 100 |
| Nội dung | content | Paragraph | yes | 2000 |
| Giá | price | Short | no | 100 |
| Liên hệ | contact | Short | no | 200 |

(4 fields, dưới giới hạn 5)

### Embed (post-embed.js)
```js
buildPostEmbed(post, { state }) // state: 'pending' | 'approved' | 'rejected'
// author: { name: post.author_tag, iconURL: post.author_avatar }
// title: post.title
// description: post.content
// fields: [{ name: 'Giá', value: price }, { name: 'Liên hệ', value: contact }] (chỉ thêm nếu có)
// footer: state badge + post id
// color: pending=blue, approved=green, rejected=red
```

### Buttons (review message)
```
[✅ Duyệt]  customId: post:approve:<postId>  style: Success
[❌ Từ chối] customId: post:reject:<postId>   style: Danger
```

### Channel Guard
`/post` command execute() phải kiểm tra:
```js
if (interaction.channel.id !== settings.post_entry_channel_id) {
  return interaction.reply({
    content: `🚫 Vui lòng dùng lệnh này trong <#${settings.post_entry_channel_id}>`,
    ephemeral: true
  })
}
```

### Service: `post-service.js`
```js
createPendingPost(client, guild, member, modalFields) {
  // 1. Validate settings.post_entry_channel_id + review_channel_id + public_forum_id set
  // 2. db.createPost(...) → postId
  // 3. Build embed + buttons với postId
  // 4. reviewChannel.send({ embeds, components }) → message
  // 5. db.setPostReviewMessage(postId, message.id)
  // 6. DM member: "Bài đã gửi duyệt, ID: #postId"
  // 7. Return { postId, messageUrl }
}
```

## Implementation Steps
1. Tạo `post-embed.js` thuần (no Discord API, chỉ build EmbedBuilder + ActionRow)
2. Tạo `post-service.js` với `createPendingPost`
3. Tạo `commands/post.js`:
   - `data`: SlashCommandBuilder `.setName('post').setDescription(...)`
   - `execute(interaction)`: build modal → `interaction.showModal(modal)`
4. Modal submit handler sẽ làm ở Phase 04 (interaction-create.js) — phase này chỉ show modal
5. **Tạm thời** để modal handler trong `bot/src/index.js` cho test, sẽ refactor ở Phase 04

## Todo
- [ ] `post-embed.js`: `buildPostEmbed()`, `buildReviewButtons(postId)`
- [ ] `post-service.js`: `createPendingPost()`
- [ ] `commands/post.js`: slash + channel guard + modal show
- [ ] Tạm wire modal submit handler để test E2E phase này
- [ ] Test: chạy `/post` → modal → submit → message hiện trong #review với 2 button
- [ ] Test: chưa setup → reply ephemeral lỗi

## Success Criteria
- Member chạy `/post` mở được modal
- Submit → row INSERT trong DB, message hiện trong #review với buttons
- DM member nhận được thông báo

## Risks
- Modal interaction timeout 15 phút → nếu bot down lúc submit thì mất data: chấp nhận, không retry
- Member close DM → log warn, không fail flow
