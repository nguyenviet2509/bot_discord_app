---
phase: 5
title: "Startup Sweep"
status: pending
priority: P2
effort: "1h"
dependencies: [4]
---

# Phase 5: Startup Sweep

## Overview

Khi bot restart, in-memory timer mất → session pending có thể bị zombie. Implement startup sweep: cancel session đã hết hạn, re-schedule timer cho session còn hạn, force-cancel session stuck `rolling`.

## Requirements

**Functional:**
- Khi bot ready: query tất cả session `state IN ('open','rolling')`
- `state='rolling'` → force-cancel với reason "Bot restart giữa lúc roll"
- `state='open'` AND `expires_at < now` → cancel với reason "Hết hạn khi bot restart"
- `state='open'` AND `expires_at > now` → re-schedule timer qua `roll-timeout.set`

**Non-functional:**
- Không block bot start (chạy async sau ready)
- Catch error cho từng session, không cho 1 session lỗi làm dừng sweep

## Architecture

```
bot/src/index.js  →  client.once('ready', async () => {
  ...
  await registerCommands()
  await miniGameSweepOnStartup(client)  ← thêm
})

miniGameSweepOnStartup helper trong:
  bot/src/modules/mini-game/services/roll-lifecycle.js
    sweepOnStartup(client) → async
```

## Related Code Files

- **Modify:**
  - `bot/src/index.js` — gọi sweep trong ready handler
- **Already created (phase 2):**
  - `bot/src/modules/mini-game/services/roll-lifecycle.js` — function `sweepOnStartup`

## Implementation Steps

### 5.1. Implement `sweepOnStartup` trong `roll-lifecycle.js`

```js
async function sweepOnStartup(client) {
  const sessions = store.listActiveSessions()  // state IN ('open','rolling')
  const now = Math.floor(Date.now() / 1000)
  console.log(`[roll:sweep] Tìm thấy ${sessions.length} session cần xử lý`)

  for (const s of sessions) {
    try {
      if (s.state === 'rolling') {
        // Stuck rolling từ trước restart → force cancel
        await forceCancelAndEdit(client, s, 'Bot restart giữa lúc roll')
      } else if (s.expires_at < now) {
        // Hết hạn rồi
        await forceCancelAndEdit(client, s, 'Hết hạn khi bot restart')
      } else {
        // Còn hạn → re-schedule timer
        const diffMs = (s.expires_at - now) * 1000
        timeoutMgr.set(s.id, diffMs, () => onExpire(client, s.id))
        console.log(`[roll:sweep] Re-schedule session #${s.id} (${diffMs}ms)`)
      }
    } catch (err) {
      console.error(`[roll:sweep] Lỗi session #${s.id}:`, err)
    }
  }
}

async function forceCancelAndEdit(client, session, reason) {
  store.cancelSession(session.id, reason)
  // Edit message nếu còn fetch được
  try {
    const ch = await client.channels.fetch(session.channel_id)
    const msg = await ch.messages.fetch(session.message_id)
    const participants = store.listParticipants(session.id)
    await msg.edit({
      embeds: [renderer.buildCancelEmbed({ session, participants, reason })],
      components: [],
    })
  } catch (err) {
    console.warn(`[roll:sweep] Không edit được message session #${session.id}:`, err.message)
  }
}
```

Thêm `listActiveSessions` vào `roll-session-store.js`:
```js
function listActiveSessions() {
  return db().prepare(
    "SELECT * FROM roll_session WHERE state IN ('open','rolling')"
  ).all()
}
```

### 5.2. Gọi sweep từ `bot/src/index.js`

```js
// Trong client.once('ready', ...)
const rollLifecycle = require('./modules/mini-game/services/roll-lifecycle')

client.once('ready', async () => {
  console.log(`[Bot] ✅ Ready! Logged in as ${client.user.tag}`)
  await registerCommands()
  // ... các initial khác
  rollLifecycle.sweepOnStartup(client).catch(err => console.error('[roll:sweep]', err))
})
```

Note: gọi `.catch(...)` thay vì `await` để không block bot ready nếu sweep chậm với nhiều session.

### 5.3. Manual test scenarios

1. **Stuck rolling**: dùng SQLite browser update 1 row thành `state='rolling'`, restart bot → row phải bị cancel
2. **Expired**: tạo session với `thoi-han-phut=1`, restart bot sau 2 phút → cancel
3. **Future**: tạo session với `thoi-han-phut=10`, restart bot ngay → timer reschedule, sau 10 phút auto cancel (nếu < 2 người)

## Success Criteria

- [ ] Bot start không bị block (sweep chạy async)
- [ ] Stuck `rolling` → cancel + edit embed
- [ ] Expired `open` → cancel + edit embed
- [ ] Future `open` → timer reschedule, đến hạn fire `onExpire`
- [ ] Lỗi từ 1 session không làm dừng sweep cho session khác
- [ ] Log rõ ràng cho debug

## Risk Assessment

| Risk | Severity | Mitigation |
|------|---------|-----------|
| `client.channels.fetch` fail (channel bị xóa) | Low | Try/catch, log warn |
| Nhiều session cùng cancel → log spam | Low | Acceptable, debug only |
| Bot crash trong lúc sweep | Low | Mỗi session try/catch độc lập, sweep idempotent (restart lại sẽ chạy tiếp) |
