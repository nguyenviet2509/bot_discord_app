# Phase 01 — Backend: Health Detection + Restart All

## Overview
- Priority: High
- Status: pending
- Adds gateway-event listeners, realtime `isRunning()`, status recompute on GET, endpoint `POST /managed-bots/restart-all`.

## Files
**Modify:**
- `bots-lite/lite-client.js`
- `dashboard/routes/managed-bots.js`

**No new files.**

## Implementation Steps

### 1. `bots-lite/lite-client.js`

Import `Status` từ discord.js:
```js
const { Client, GatewayIntentBits, ActivityType, Status } = require('discord.js')
```

Trong `start()` sau khi `this.client = new Client(...)`, ngay sau 2 dòng `on('error'/'shardError')`, thêm:
```js
this.client.on('shardDisconnect', (event, shardId) => {
  this.ready = false
  this.onError(new Error(`Shard ${shardId} disconnect: code=${event?.code}`))
})
this.client.on('shardResume', () => { this.ready = true })
this.client.on('shardReady', () => { this.ready = true })
this.client.once('invalidated', () => {
  this.ready = false
  this.onError(new Error('Session invalidated — cần restart bot'))
  try { this.client?.destroy() } catch (_) {}
  this.client = null
})
```

Sửa `isRunning()`:
```js
isRunning() {
  return this.ready && !!this.client && this.client.ws?.status === Status.Ready
}
```

### 2. `dashboard/routes/managed-bots.js`

Sửa `GET /` để override status realtime:
```js
router.get('/', (req, res) => {
  const bots = dbManaged.listBots().map((b) => {
    const enriched = withCanChangeUsername(b)
    const realtimeRunning = manager.isRunning(b.id)
    return {
      ...enriched,
      status: realtimeRunning ? 'running' : (b.status === 'error' ? 'error' : 'stopped'),
    }
  })
  res.json(bots)
})
```

Thêm endpoint mới (đặt trước `router.use((err, req, res, next) => ...)` ở cuối file):
```js
router.post('/restart-all', async (req, res) => {
  const ids = dbManaged.listDesiredRunningIds()
  let restarted = 0
  let failed = 0
  for (const id of ids) {
    try {
      if (manager.isRunning(id)) {
        await manager.stop(id).catch(() => {})
      }
      // Đảm bảo desired_state vẫn = running (stop() chỉ update status, không đổi desired)
      await manager.start(id)
      restarted++
    } catch (err) {
      failed++
      console.error(`[restart-all] bot #${id}: ${err.message}`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  res.json({ restarted, failed, total: ids.length })
})
```

**Lưu ý:** `manager.stop(id)` ghi DB `status='stopped'` nhưng KHÔNG đổi `desired_state` (xem [bots-lite/index.js:77-85](../../bots-lite/index.js#L77-L85) — chỉ route `/:id/stop` mới gọi `setDesiredState`).

## Todo
- [ ] Import `Status` trong `lite-client.js`
- [ ] Thêm 4 listeners (`shardDisconnect`/`shardResume`/`shardReady`/`invalidated`)
- [ ] Update `isRunning()` realtime check ws.status
- [ ] Override status realtime trong `GET /managed-bots`
- [ ] Thêm endpoint `POST /managed-bots/restart-all`
- [ ] Chạy `node -e "require('./bots-lite')"` check load OK

## Success Criteria
- Stop network 30s → log có "Shard X disconnect" → `GET /managed-bots` trả `status: 'stopped'`.
- Resume network → log có shardResume/shardReady → next `GET` trả `running`.
- `POST /restart-all` trả `{ restarted, failed, total }` đúng.

## Risks
- Nếu discord.js version <14 thiếu `Status` export — check `package.json`. Bot codebase đã chạy discord.js v14 (xem `LiteClient.constructor` dùng `GatewayIntentBits` — v14+ API).
- `invalidated` xoá `this.client` nhưng manager.clients Map vẫn giữ entry — OK vì `start(id)` next lần sẽ `clients.delete(id)` rồi tạo lại ([bots-lite/index.js:37-40](../../bots-lite/index.js#L37-L40)).
