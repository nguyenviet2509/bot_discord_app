---
phase: 1
title: "Refactor buttons: split public vs host, strict host check"
status: pending
priority: P1
effort: "1h"
dependencies: []
---

# Phase 1: Refactor Buttons

## Overview

Split button rendering thành 2 nhóm (public 1 nút / host 2 nút), route customId riêng cho host actions, strict host-only check.

## Related Code Files

**Modify:**
- `bot/src/modules/mini-game/services/roll-renderer.js`
- `bot/src/modules/mini-game/handlers/roll-button-handler.js`
- `bot/src/modules/mini-game/services/roll-lifecycle.js`
- `bot/src/modules/mini-game/commands/roll.js`

## Implementation Steps

### 1.1. `roll-renderer.js` — tách button builders

Đổi `buildPendingButtons` thành 2 hàm:

```js
// Public: 1 nut toggle Tham gia/Roi khoi cho moi member
function buildPublicButtons(sessionId, joined) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mg:roll:join:${sessionId}`)
      .setLabel(joined ? 'Rời khỏi' : 'Tham gia')
      .setEmoji(joined ? '🚪' : '🎯')
      .setStyle(joined ? ButtonStyle.Secondary : ButtonStyle.Primary),
  )
}

// Host-only: 2 nut Start + Cancel gui qua ephemeral
function buildHostButtons(sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mg:roll:host-start:${sessionId}`)
      .setLabel('Bắt đầu roll')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`mg:roll:host-cancel:${sessionId}`)
      .setLabel('Hủy session')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
  )
}

module.exports = { ...buildPublicButtons, buildHostButtons, /* các hàm khác giữ nguyên */ }
```

Xóa `buildPendingButtons` (hoặc keep alias trỏ về `buildPublicButtons` cho backward-compat trong sweep code).

### 1.2. `roll-button-handler.js` — route customId mới

```js
const lifecycle = require('../services/roll-lifecycle')
const store = require('../services/roll-session-store')

async function handle(interaction) {
  const id = interaction.customId
  if (!id.startsWith('mg:roll:')) return false
  const parts = id.split(':')
  const action = parts[2] // 'join' | 'host-start' | 'host-cancel'
  if (!/^\d+$/.test(parts[3] || '')) {
    return interaction.reply({ content: 'Session id không hợp lệ.', ephemeral: true }).then(() => true)
  }
  const sessionId = parseInt(parts[3], 10)

  const session = store.getSession(sessionId)
  if (!session) {
    return interaction.reply({ content: 'Session không tồn tại.', ephemeral: true }).then(() => true)
  }

  // Public action: validate message.id == session.message_id (chong hijack tu message khac)
  // Host action: ephemeral message.id KHAC session.message_id -> skip check
  if (action === 'join') {
    if (session.message_id !== interaction.message?.id || session.channel_id !== interaction.channelId) {
      return interaction.reply({ content: '⚠️ Button không thuộc session này.', ephemeral: true }).then(() => true)
    }
  } else if (action === 'host-start' || action === 'host-cancel') {
    if (session.channel_id !== interaction.channelId) {
      return interaction.reply({ content: '⚠️ Phải ở cùng channel với session.', ephemeral: true }).then(() => true)
    }
  }

  try {
    if (action === 'join')        { await lifecycle.onJoin(interaction, sessionId);   return true }
    if (action === 'host-start')  { await lifecycle.onStart(interaction, sessionId);  return true }
    if (action === 'host-cancel') { await lifecycle.onCancel(interaction, sessionId); return true }
  } catch (err) {
    console.error('[mg:roll:button]', err)
    const msg = { content: '❌ Lỗi xử lý nút bấm.', ephemeral: true }
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {})
    else await interaction.reply(msg).catch(() => {})
    return true
  }
  return false
}
```

### 1.3. `roll-lifecycle.js` — strict host check

Đổi `ensureHostOrAdmin` thành `ensureHost`:

```js
async function ensureHost(interaction, session) {
  if (interaction.user.id === session.host_id) return true
  await interaction.reply({ content: '🚫 Chỉ host (người tạo session) mới được dùng nút này.', ephemeral: true })
  return false
}
```

Cập nhật `onStart` và `onCancel` gọi `ensureHost` thay vì `ensureHostOrAdmin`. Bỏ import `PermissionsBitField` nếu không còn ai dùng.

`rerenderPendingMessage`: dùng `renderer.buildPublicButtons(sessionId, false)` (đã đổi tên).

### 1.4. `commands/roll.js` — ephemeral kèm host buttons

Thay thế đoạn `editReply` cuối:

```js
return interaction.editReply({
  content: `✅ Đã tạo ROLL Session #${session.id}. Hết hạn <t:${expiresAt}:R>.\n\n**Điều khiển session** (chỉ bạn thấy):`,
  components: [renderer.buildHostButtons(session.id)],
})
```

Edit public message với `buildPublicButtons` (đã đổi tên):

```js
await msg.edit({
  content: '',
  embeds: [renderer.buildPendingEmbed({ session, participants: [] })],
  components: [renderer.buildPublicButtons(session.id, false)],
  allowedMentions: { parse: [] },
}).catch(err => console.error('[roll:edit-initial]', err))
```

### 1.5. Compile + test

```bash
node -e "require('./bot/src/modules/mini-game/services/roll-renderer.js'); require('./bot/src/modules/mini-game/handlers/roll-button-handler.js'); require('./bot/src/modules/mini-game/services/roll-lifecycle.js'); require('./bot/src/modules/mini-game/commands/roll.js'); console.log('OK')"
```

## Success Criteria

- [ ] Public message chỉ có 1 nút Tham gia/Rời khỏi
- [ ] Sau `/roll-start`, host nhận ephemeral kèm 2 nút Bắt đầu + Hủy
- [ ] Member không phải host bấm host-start/host-cancel → reject ephemeral
- [ ] Member bấm join → toggle hoạt động bình thường
- [ ] Host bấm Bắt đầu trong ephemeral → public message update thành result embed
- [ ] Host bấm Hủy trong ephemeral → public message update thành cancel embed

## Risk Assessment

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Ephemeral interaction expire 15m mid-session với timer > 15m | Medium | Button click tạo interaction mới (vẫn dùng được). `/roll-control` (Phase 2) fallback. |
| Sweep code dùng `buildPendingButtons` cũ | Low | Sweep chỉ render cancel embed `components: []` → không đụng button builder. Check kỹ trong refactor. |
| customId mới (host-start/host-cancel) cũ không có → button cũ trên message cũ pre-deploy → bấm không match | Low | Sau deploy, session active cũ sẽ timeout → không vấn đề lâu dài. |
