# Phase 2 — Shared Embed Builder

**Priority:** P0
**Status:** pending
**Effort:** S (~30 min)
**Depends on:** Phase 1

## Overview
Module dùng chung cho bot (gửi thật) và dashboard (preview): build embed Champion Spotlight (Mock 4 đã chỉnh) từ payload đầu vào.

## Related files
- **Create:** `shared/build-honor-embed.js`

## API

```js
/**
 * Build Champion Spotlight embed.
 * @param {Object} payload
 * @param {string} payload.title         - Tiêu đề (vd "BẢNG VÀNG THÁNG 5/2026")
 * @param {string} payload.guildName     - Tên guild (cho footer)
 * @param {string} [payload.guildIconUrl]
 * @param {{id, name, avatarUrl, reason}} payload.user1  - quán quân
 * @param {{id, name, avatarUrl, reason}} payload.user2  - á quân
 * @param {{id, name, avatarUrl, reason}} payload.user3  - hạng ba
 * @param {string} payload.bannerUrl     - URL ảnh banner (attachment hoặc URL)
 * @returns {{ content, embeds }}        - sẵn sàng truyền vào channel.send()
 */
function buildHonorEmbed(payload) { ... }
```

## Embed structure (output)

```js
{
  content: `🎉 Chúc mừng <@${user1.id}> <@${user2.id}> <@${user3.id}> 🎉`,
  embeds: [{
    author: { name: `🏛️ ${title}`, icon_url: guildIconUrl },
    title: `🥇 QUÁN QUÂN — ${user1.name}`,
    description: `> *"${user1.reason}"*`,
    color: 0xFFD700,
    thumbnail: { url: user1.avatarUrl },
    fields: [
      { name: '🥈 Á QUÂN', value: `**${user2.name}**\n${user2.reason}`, inline: true },
      { name: '🥉 HẠNG BA', value: `**${user3.name}**\n${user3.reason}`, inline: true }
    ],
    image: { url: bannerUrl },
    footer: { text: `✦ Vinh danh bởi ${guildName} ✦` },
    timestamp: new Date().toISOString()
  }]
}
```

## Implementation steps
1. Tạo `shared/build-honor-embed.js`
2. Xuất `buildHonorEmbed(payload)` trả về object `{ content, embeds }`
3. Escape markdown trong `reason` để tránh user inject (vd `*`, `_`, `` ` ``) — dùng helper nhỏ
4. Validate input: nếu thiếu field bắt buộc → throw `new Error('Missing ...')`

## Todo
- [ ] Tạo file + implement buildHonorEmbed
- [ ] Helper escapeMd cho reason
- [ ] Validate input throw rõ ràng

## Success criteria
- Gọi với payload đầy đủ → trả về `{content, embeds}` đúng format
- Thiếu field bắt buộc → throw lỗi rõ ràng
- Reason chứa `**bold**` không bị render thành bold thật
