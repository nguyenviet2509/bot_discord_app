# Phase 3 — Bot Slash Command `/vinhdanh` + Modal

**Priority:** P0
**Status:** pending
**Effort:** M (~1.5h)
**Depends on:** Phase 1, 2

## Overview
Slash command `/vinhdanh` với 3 user options + banner attachment + channel optional. Sau khi gõ → hiện modal nhập tiêu đề + 3 lý do. Submit → build embed + gửi + lưu DB + react.

## Related files
- **Create:** `bot/src/commands/vinh-danh.js` (data + execute + modal handler)
- **Create:** `bot/src/services/honor-service.js` (orchestration)
- **Modify:** `bot/src/events/interaction-create.js` (route modal submit nếu chưa generic)

## Command shape

```js
new SlashCommandBuilder()
  .setName('vinhdanh')
  .setDescription('Vinh danh Top 3 thành viên đóng góp xuất sắc')
  .addUserOption(o => o.setName('user1').setDescription('Quán quân (#1)').setRequired(true))
  .addUserOption(o => o.setName('user2').setDescription('Á quân (#2)').setRequired(true))
  .addUserOption(o => o.setName('user3').setDescription('Hạng ba (#3)').setRequired(true))
  .addAttachmentOption(o => o.setName('banner').setDescription('Ảnh banner').setRequired(true))
  .addChannelOption(o => o.setName('channel').setDescription('Channel đăng (mặc định: hiện tại)'))
  .setDefaultMemberPermissions(0)  // ẩn khỏi @everyone, dùng custom role check
```

## Flow chi tiết

1. **execute(interaction):**
   - `getHonorSettings(guildId)` → check `interaction.member.roles` có chứa ít nhất 1 role trong `allowed_role_ids` không (hoặc user có ManageGuild fallback)
   - Nếu không có quyền → `interaction.reply({content: '🚫 Bạn không có quyền dùng lệnh này.', ephemeral: true})`
   - Lưu tạm các option vào `interaction.client.honorPending` (Map keyed by `${userId}:${guildId}`) — TTL 5 phút:
     - user1Id, user2Id, user3Id
     - bannerAttachmentUrl (lấy từ `attachment.url`)
     - targetChannelId
   - Hiển thị modal với 4 input:
     - title (default = `BẢNG VÀNG THÁNG ${MM}/${YYYY}`)
     - reason1
     - reason2
     - reason3
   - `customId` của modal = `honor_modal:<nonce>` (nonce = key map)

2. **handleModalSubmit(interaction):**
   - Nếu `customId.startsWith('honor_modal:')` → handle
   - Lấy pending data từ Map, xoá entry
   - Validate: reason không empty, length <= 200
   - Fetch user objects (cho avatar + display name)
   - Gọi `honor-service.publishHonor(interaction, data)` (xem dưới)
   - Reply ephemeral: "✅ Đã gửi vinh danh tới #channel"

3. **honor-service.publishHonor(interaction, data):**
   - Build payload qua `buildHonorEmbed(...)`
   - Fetch banner: discord.js auto handle URL trong `image.url` (Discord re-host)
   - Gửi tới target channel: `await channel.send({content, embeds})`
   - `await message.react('🎉')` rồi `await message.react('👏')`
   - `insertHonorRecord({...})` → lấy id
   - `updateHonorMessageId(id, message.id)`

## Permission helper

```js
function hasHonorPermission(member, settings) {
  if (member.permissions.has('Administrator')) return true
  const allowed = settings?.allowed_role_ids || []
  if (!allowed.length) return member.permissions.has('ManageGuild')
  return member.roles.cache.some(r => allowed.includes(r.id))
}
```

## Implementation steps
1. Tạo `bot/src/commands/vinh-danh.js`:
   - Export `data` (SlashCommandBuilder)
   - Export `execute` (hiện modal)
   - Export `handleModalSubmit` (xử lý submit)
2. Tạo `bot/src/services/honor-service.js`:
   - `publishHonor(client, channel, data, createdById)` → gửi + react + persist
3. Check `bot/src/events/interaction-create.js`:
   - Đã có generic modal routing chưa? Nếu chưa → thêm:
     ```js
     if (interaction.isModalSubmit()) {
       if (interaction.customId.startsWith('honor_modal:')) {
         const cmd = client.commands.get('vinhdanh')
         return cmd.handleModalSubmit(interaction)
       }
     }
     ```
4. Đảm bảo client có `honorPending = new Map()` khởi tạo trong `index.js`

## Risk & mitigation
- **Modal timeout 15 phút:** Map TTL 5 phút đủ
- **Banner attachment URL temporary:** Discord URL valid 24h trở lên, đủ để send embed ngay. Sau đó URL trong DB chỉ để tham khảo lịch sử
- **3 user trùng nhau:** Validate ở execute → reply error
- **Reason chứa newline:** Modal `Paragraph` style cho phép, nhưng giới hạn 200 chars

## Todo
- [ ] Tạo vinh-danh.js (data + execute + handleModalSubmit)
- [ ] Tạo honor-service.js
- [ ] Wire modal routing trong interaction-create.js
- [ ] Khởi tạo client.honorPending Map
- [ ] Test: gõ command → modal hiện → submit → embed publish
- [ ] Test: user không có quyền → permission denied
- [ ] Test: 3 user trùng → reject

## Success criteria
- Modal hiện ngay sau khi gõ command với đủ options
- Submit modal → embed Champion Spotlight xuất hiện trong target channel < 2s
- Mention 3 user trong content message
- Bot react 🎉 và 👏
- Bản ghi xuất hiện trong `honor_history`
- Non-authorized user nhận message ephemeral "permission denied"
