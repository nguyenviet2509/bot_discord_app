---
title: "ROLL — kết quả là tin nhắn mới nhất khi finish"
date: 2026-05-25
type: brainstorm
status: ready-for-plan
---

# Brainstorm: ROLL Result As Latest Message

## Problem

Sau khi `/roll-start`, member chat trong channel làm trôi message ROLL lên trên. Khi roll xong, bot edit message cũ thành result embed → kết quả vẫn ở vị trí cũ, member khó tìm.

## Decisions

| # | Quyết định |
|---|------------|
| 1 | Khi finish: **delete message cũ + post message mới** với full result embed |
| 2 | Scope: **chỉ khi finished** (có winner). Cancel/expire giữ flow cũ (edit in-place). |
| 3 | Mention: **chỉ ping winner** (giống allowedMentions hiện tại) |

## Solution Design

### Flow change trong `roll-lifecycle.onStart`

**Hiện tại:**
```js
// Sau rollAndSettle commit:
await renderer.editNow(sessionId, async () => {
  await msg.edit({ embeds: [resultEmbed], components: [], allowedMentions: {users: [winnerId]} })
})
```

**Mới:**
```js
// Sau rollAndSettle commit:
await msg.delete().catch(err => console.warn('[roll:delete-old]', err.message))
const newMsg = await channel.send({
  embeds: [renderer.buildResultEmbed({ session: finalSession, rankedParticipants: ranked })],
  allowedMentions: { users: [result.winnerId] },
})
store.setMessageId(sessionId, newMsg.id) // update DB consistency
```

### Files Changes

**Modify:**
- `bot/src/modules/mini-game/services/roll-lifecycle.js` — `onStart` repost flow
- `bot/src/modules/mini-game/services/roll-session-store.js` — thêm `setMessageId(id, messageId)` helper

### Pseudocode chi tiết

```js
// Trong onStart sau rollAndSettle:
const finalSession = store.getSession(sessionId)
const channel = await interaction.client.channels.fetch(finalSession.channel_id).catch(() => null)
if (channel) {
  // 1. Delete message cu (best-effort)
  try {
    const oldMsg = await channel.messages.fetch(finalSession.message_id).catch(() => null)
    if (oldMsg) await oldMsg.delete()
  } catch (err) {
    console.warn('[roll:delete-old]', err.message)
  }
  // 2. Post message moi voi result embed
  const newMsg = await channel.send({
    embeds: [renderer.buildResultEmbed({ session: finalSession, rankedParticipants: ranked })],
    allowedMentions: { users: [result.winnerId] },
  })
  // 3. Update DB de consistency (dashboard detail link, audit)
  store.setMessageId(sessionId, newMsg.id)
}
renderer.dropSession(sessionId)
```

## Pros / Cons

| Pros | Cons |
|------|------|
| Result luôn ở cuối channel → member dễ thấy | Jump link cũ (nếu ai bookmark) sẽ chết — acceptable cho fun-game |
| Sạch sẽ, 1 message duy nhất | Thêm 2 API call (delete + send) thay vì 1 (edit) — không đáng kể |
| Reuse `buildResultEmbed` đã có | Nếu delete fail (channel bị xóa, perm thay đổi) → fallback `send` vẫn work, chỉ là có 2 message |

## Risks & Mitigation

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Channel bị xoá giữa lúc roll | Low | `channels.fetch` return null → skip repost, result vẫn trong DB |
| Bot mất perm `SendMessages` | Low | try/catch + log, không crash |
| Delete fail nhưng send OK → 2 message | Low | Acceptable, user vẫn thấy result mới ở cuối |
| Race: button click sau delete cũ trước send mới (< 100ms) | Very Low | Button interaction fail ephemeral — chấp nhận |

## Effort

~20p:
- Add `setMessageId` to store: 3p
- Refactor `onStart` repost flow: 10p
- Manual test 3 scenarios (happy path, channel deleted, perm denied): 7p

## Success Criteria

- [ ] Khi host bấm Bắt đầu → message cũ bị xoá, message mới với result embed ở cuối channel
- [ ] Winner được ping
- [ ] Cancel/expire vẫn edit in-place (không repost)
- [ ] DB `message_id` cập nhật về ID message mới
- [ ] Dashboard detail vẫn hoạt động (message_id trỏ đến result message)

## Out of Scope

- Pending message re-post (chat trôi pending message → không xử lý, button vẫn click được qua scroll)
- Cancel/expire repost
- Edit cũ + post short ping (đã loại ở decision #1)

## Unresolved Questions

Không có.
