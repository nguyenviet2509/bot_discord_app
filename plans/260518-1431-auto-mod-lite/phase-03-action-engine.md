# Phase 3 — Action Engine + Logging + Hook message-create

**Priority:** P0
**Status:** pending
**Effort:** 1 ngày
**Depends on:** Phase 2

## Context
- Phase 2 đã có rules engine detect violation, chưa apply action
- Moderation commands có sẵn: `bot/src/commands/mute.js`, `kick.js` (logic timeout/kick)
- Event: `bot/src/events/message-create.js` cần chèn pipeline auto-mod ở đầu

## Overview
Viết `action-engine.js` áp dụng ladder (warn → mute 5m → mute 1h → kick). Tích hợp vào event `message-create` chạy TRƯỚC logic XP, early-return nếu tin bị xóa.

## Action ladder (default, config được)

| Warn count | Action |
|---|---|
| 1 | Delete + warn DM |
| 2 | Delete + mute 5 phút |
| 3 | Delete + mute 1 giờ |
| 4+ | Delete + kick |

Warn count = `countActiveWarns(guildId, userId, 86400)` (24h).

## action-engine.js API

```js
async function applyAction(message, violation) {
  const { rule, reason } = violation
  const guildId = message.guild.id
  const userId = message.author.id

  // 1. Add warn record
  dbAutomod.addWarn(guildId, userId, rule)
  const warnCount = dbAutomod.countActiveWarns(guildId, userId, 86400)

  // 2. Determine action
  const action = pickAction(warnCount)  // 'delete' | 'mute-5m' | 'mute-1h' | 'kick'

  // 3. Delete message
  await message.delete().catch(() => {})

  // 4. Apply punishment
  if (action.startsWith('mute')) {
    const minutes = action === 'mute-5m' ? 5 : 60
    await message.member.timeout(minutes * 60 * 1000, `[Auto-Mod] ${rule}: ${reason}`).catch(() => {})
  } else if (action === 'kick') {
    await message.member.kick(`[Auto-Mod] ${rule}: ${reason}`).catch(() => {})
  }

  // 5. Notify user (DM → fallback channel ephemeral)
  await notifyUser(message, action, rule, reason)

  // 6. Log
  dbAutomod.addLog({
    guildId, userId, rule, action,
    messageExcerpt: message.content.slice(0, 200),
    channelId: message.channel.id,
  })
}
```

## Integration point

Modify `bot/src/events/message-create.js`:

```js
async execute(message, client) {
  if (message.author.bot) return
  if (!message.guild) return

  // ============ AUTO-MOD PIPELINE (chèn ở đây) ============
  if (client._moduleMessageHandlers?.length) {
    for (const handler of client._moduleMessageHandlers) {
      try { await handler(message) } catch (e) { console.error('[messageHandler]', e) }
    }
    // Nếu auto-mod đánh dấu violation, gọi action engine + return
    if (message._automodViolation) {
      const { applyAction } = require('../modules/auto-mod/action-engine')
      await applyAction(message, message._automodViolation)
      return  // KHÔNG chạy tiếp logic XP/link
    }
  }
  // ============ END AUTO-MOD ============

  // Analytics counters (giữ nguyên)
  ...
}
```

**Lưu ý:** Việc gọi `applyAction` đặt ở event chứ không trong register handler để giữ register pure (chỉ detect). Tách concern rõ.

**Alternative:** action-engine có thể được gọi từ register handler luôn để đơn giản. Trade-off:
- Gọi từ event: dễ test register, control flow rõ
- Gọi từ register: đỡ phải sửa message-create
→ **Chọn gọi từ event** để rõ pipeline (detect → act).

## notifyUser logic
```js
async function notifyUser(message, action, rule, reason) {
  const text = `⚠️ Tin nhắn của bạn vi phạm quy tắc **${rule}** (${reason}). Hành động: ${action}`
  try {
    await message.author.send(text)
  } catch {
    // Fallback: gửi ephemeral trong channel
    await message.channel.send({ content: `<@${message.author.id}> ${text}`, allowedMentions: { users: [message.author.id] } })
      .then(m => setTimeout(() => m.delete().catch(() => {}), 10000))
  }
}
```

## Files
- **Create:** `bot/src/modules/auto-mod/action-engine.js`
- **Modify:** `bot/src/events/message-create.js`

## Implementation steps
1. Viết `action-engine.js` với `pickAction()` đọc ladder từ config (fallback default).
2. Viết `notifyUser()` DM + fallback.
3. Modify `message-create.js`: chèn pipeline auto-mod ở đầu, return khi violation.
4. Smoke test:
   - Spam 5 tin → tin thứ 5 bị xóa, DM nhận được warn
   - Spam tiếp → bị mute 5 phút
   - Test invite link → bị xóa ngay
   - Test bad-word → bị xóa
   - Whitelist admin → không bị check

## Todo
- [ ] `action-engine.js` (applyAction + pickAction + notifyUser)
- [ ] Modify `message-create.js` (chèn pipeline)
- [ ] Smoke test 5 rule × 2 ladder bậc đầu
- [ ] Verify log row được tạo đúng

## Success criteria
- Vi phạm bị xử lý đúng ladder
- Tin XP/link KHÔNG được tính khi bị auto-mod
- DM thất bại → fallback ephemeral hoạt động
- Log đầy đủ thông tin (action, excerpt, channel)

## Risks
- **Bot thiếu quyền timeout/kick:** Catch error, log warning, vẫn xóa tin
- **Race condition giữa nhiều rule cùng violate:** Rules-engine early-exit ở rule đầu tiên → OK
- **Spam handler không đồng bộ:** Chấp nhận, flood detect đã đếm chính xác qua state.push()
