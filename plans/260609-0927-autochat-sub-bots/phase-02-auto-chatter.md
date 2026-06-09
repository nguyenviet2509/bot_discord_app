# Phase 02 — Auto-chatter scheduler + Lifecycle

**Status:** pending
**Priority:** high
**Depends on:** Phase 01
**Files:** `bots-lite/auto-chatter.js` (new), `bots-lite/index.js`

## Mục tiêu

Module scheduler quản lý timer per-bot. Tích hợp start/stop với LiteClient lifecycle.

## Module mới `bots-lite/auto-chatter.js`

### API

```js
function schedule(botId, getClient)   // start timer cho 1 bot (cancel timer cũ nếu có)
function cancel(botId)                 // clear timeout
function cancelAll()                   // dọn khi shutdown
function isScheduled(botId)            // boolean
async function sendOnce(botId, getClient) // gửi random 1 câu ngay (test button), không reschedule
```

### Logic tick

```js
async function tick(botId, getClient) {
  const cfg = dbManaged.getAutochatConfig(botId)
  if (!cfg.enabled || !cfg.channel_id) return cancel(botId)

  const messages = dbManaged.listMessages(botId)
  if (messages.length === 0) {
    // không có câu → vẫn reschedule, đợi user add
    return scheduleNext(botId, getClient, cfg)
  }

  const client = getClient(botId)
  if (!client?.isRunning()) {
    // bot chưa running, đợi tick sau
    return scheduleNext(botId, getClient, cfg)
  }

  try {
    const msg = messages[Math.floor(Math.random() * messages.length)]
    const channel = await client.client.channels.fetch(cfg.channel_id)
    if (channel?.isTextBased()) {
      await channel.send(msg.content)
    }
  } catch (err) {
    console.error(`[auto-chatter#${botId}] send fail:`, err.message)
    dbManaged.updateStatus(botId, 'running', `autochat: ${err.message.slice(0, 200)}`)
  }
  scheduleNext(botId, getClient, cfg)
}

function scheduleNext(botId, getClient, cfg) {
  const min = Math.max(1, cfg.min_minutes)
  const max = Math.max(min, cfg.max_minutes)
  const delayMin = Math.random() * (max - min) + min
  const delayMs = Math.floor(delayMin * 60 * 1000)
  const timer = setTimeout(() => tick(botId, getClient), delayMs)
  timers.set(botId, timer)
}
```

State: `const timers = new Map() // botId → Timeout`

`schedule()` = cancel cũ + scheduleNext (delay đầu tiên cũng random, không gửi ngay khi start).

## Tích hợp `bots-lite/index.js`

Inject `getClient = (id) => clients.get(id)` vào auto-chatter.

```js
const autoChatter = require('./auto-chatter')
const getClient = (id) => clients.get(id)

// start(id): sau khi clients.set(id, client) thành công
const cfg = dbManaged.getAutochatConfig(id)
if (cfg.enabled && cfg.channel_id) {
  autoChatter.schedule(id, getClient)
}

// stop(id): trước khi clients.delete
autoChatter.cancel(id)

// stopAll: thêm autoChatter.cancelAll() ở đầu

// Export thêm: autoChatter (để route layer dùng cho test-send + toggle realtime)
```

## Toggle realtime

Khi user PUT config với `enabled` thay đổi:
- `enabled: true` + bot đang running → `autoChatter.schedule(id, getClient)`
- `enabled: false` → `autoChatter.cancel(id)`
- Bot không running → chỉ update DB, không schedule (sẽ schedule khi start)

Khi user update `min/max/channel_id` mà đang scheduled → reschedule (cancel + schedule lại, tick mới dùng cfg mới).

## Edge cases

- Channel không tồn tại / bot mất quyền → log + reschedule (không retry burst)
- LiteClient chưa ready khi tick → reschedule, không gửi
- min === max → delay = min (random hoạt động bình thường)
- Bot bị delete khi đang scheduled → DB CASCADE xoá messages, tick sẽ tự cancel ở next tick (no-op vì getAutochatConfig trả null)

## Todo

- [ ] Tạo `bots-lite/auto-chatter.js` với schedule/cancel/cancelAll/sendOnce
- [ ] Inject autoChatter vào `bots-lite/index.js` start()
- [ ] Cancel ở stop()
- [ ] cancelAll() ở stopAll()
- [ ] Auto-schedule trong restoreAll loop (chạy sau start thành công)
- [ ] Export autoChatter từ bots-lite/index.js
- [ ] Smoke test: start bot có autochat → quan sát log → gửi 1 message → cancel

## Success criteria

- Bot start với autochat_enabled=1 → log "[auto-chatter#X] scheduled next in Y minutes"
- Tick gửi đúng message ngẫu nhiên vào đúng channel
- Stop bot → timer cleared (no leak)
- Update min/max → tick kế tiếp dùng giá trị mới
