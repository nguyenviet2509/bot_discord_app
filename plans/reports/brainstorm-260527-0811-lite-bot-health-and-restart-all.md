# Brainstorm: Lite Bot Health Detection + Restart All

## Problem
Thi thoảng lite bot (managed bots) offline trên Discord nhưng dashboard vẫn hiển thị "Đang chạy" (chấm xanh). User phải Stop → Start thủ công từng bot.

## Root Cause (3 lớp)
1. **`LiteClient.ready` never resets** — chỉ set `true` lúc `clientReady`, không reset khi gateway disconnect / session invalidated. `isRunning()` lie.
2. **Listener thiếu** — chỉ có `error`/`shardError`. Clean close, invalidated session, reconnect failure không bắn `error` → `onError` không chạy → DB không update.
3. **Dashboard đọc DB status** — `GET /managed-bots` trả field `status` từ SQLite. Status chỉ đổi khi user bấm Start/Stop hoặc `onError` fire. Zombie state = DB mãi `running`.

## Solution: A + B + D (KISS)

### A. Health listeners trong `LiteClient` ([bots-lite/lite-client.js](bots-lite/lite-client.js))
Thêm vào `start()`:
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
  try { this.client?.destroy() } catch(_) {}
  this.client = null
})
```
- `shardDisconnect` không tự destroy (discord.js tự reconnect); chỉ flip `ready=false` để dashboard hiện đúng. Khi `shardResume`/`shardReady` thì flip lại.
- `invalidated` = fatal, destroy + cleanup.
- `onError` ghi DB status='error' kèm last_error (đã có sẵn ở [bots-lite/index.js:60-63](bots-lite/index.js#L60-L63)).

### B. `isRunning()` realtime check ([bots-lite/lite-client.js:79-81](bots-lite/lite-client.js#L79-L81))
```js
const { Status } = require('discord.js')
isRunning() {
  return this.ready && !!this.client && this.client.ws?.status === Status.Ready
}
```
Dự phòng nếu event miss; tin vào ws.status thay vì biến cache.

### C. GET / list: recompute status realtime ([dashboard/routes/managed-bots.js:53-56](dashboard/routes/managed-bots.js#L53-L56))
```js
router.get('/', (req, res) => {
  const bots = dbManaged.listBots().map(b => ({
    ...withCanChangeUsername(b),
    status: manager.isRunning(b.id) ? 'running' : (b.status === 'error' ? 'error' : 'stopped'),
  }))
  res.json(bots)
})
```
Giữ `error` từ DB (để user thấy message lỗi), còn lại override bằng realtime memory state.

### D. Restart All endpoint + nút
**Backend** ([dashboard/routes/managed-bots.js](dashboard/routes/managed-bots.js)):
```js
router.post('/restart-all', async (req, res) => {
  const ids = dbManaged.listDesiredRunningIds()
  let ok = 0, fail = 0
  for (const id of ids) {
    try {
      if (manager.isRunning(id)) await manager.stop(id).catch(()=>{})
      await manager.start(id)
      ok++
    } catch (err) {
      fail++
      console.error(`[restart-all] bot #${id}: ${err.message}`)
    }
    await new Promise(r => setTimeout(r, 500)) // login burst guard
  }
  res.json({ restarted: ok, failed: fail, total: ids.length })
})
```
Lưu ý: sau `stop()` thì `dbManaged.updateStatus(id, 'stopped')` chạy, nhưng `setDesiredState` KHÔNG đổi → an toàn cho auto-restore.

**Frontend** ([dashboard/public/js/app.js](dashboard/public/js/app.js) + [index.html](dashboard/public/index.html)):
- Thêm nút "Khởi động lại tất cả" bên cạnh "Làm mới" trong header tab Quản lý Bot.
- Method:
```js
async restartAll() {
  if (!confirm('Khởi động lại tất cả bot đang bật? Mất ~vài giây/bot.')) return
  this.loading = true
  try {
    const r = await api('POST', '/managed-bots/restart-all')
    this.flash(`Đã khởi động lại ${r.restarted}/${r.total} bot (${r.failed} lỗi)`, r.failed === 0)
    await this.load()
  } catch(e) { this.flash('Thao tác thất bại', false) }
  finally { this.loading = false }
}
```
- Disable nút khi `loading` để tránh spam.

## Files thay đổi
- `bots-lite/lite-client.js` — thêm listeners + realtime `isRunning()`
- `bots-lite/index.js` — không sửa (manager.isRunning đã proxy)
- `dashboard/routes/managed-bots.js` — recompute status ở GET /, thêm POST /restart-all
- `dashboard/public/js/app.js` — thêm `restartAll()` action
- `dashboard/public/index.html` — thêm button trong header tab Quản lý Bot

## Success Criteria
1. Khi gateway disconnect (test: stop network 30s rồi resume), dashboard hiện trạng thái `stopped`/`error` trong vòng <5s sau khi shard event fire.
2. Khi resume thành công, dashboard tự refresh → hiện `running` lại (cần user bấm "Làm mới" hoặc auto-reload — KHÔNG add polling).
3. Nút "Khởi động lại tất cả" stop+start mọi bot có `desired_state='running'`, delay 500ms/bot, báo kết quả N/M thành công.
4. Không có thrashing: stop+start tuần tự, không parallel; nếu user spam nút thì FE disable lúc loading.

## Risks
- **discord.js auto-reconnect đè `ready=false`**: sau `shardDisconnect`, lib tự thử reconnect. Nếu thành công, `shardResume`/`shardReady` fire → mình flip `ready=true`. Nếu thất bại nhiều lần, lib dừng → state đứng yên ở `ready=false` = đúng intent.
- **Token revoked → restart-all loop fail**: mỗi bot fail nhanh (login throw), counter `fail++`, không retry. OK.
- **`setUsername` rate limit khi restart-all**: identity chỉ apply khi username khác hiện tại → restart không trigger lại trừ khi user vừa đổi tên. Low risk.
- **`invalidated` destroys client nhưng map vẫn giữ entry**: cần xoá khỏi `clients` map. → Trong listener `invalidated`, ngoài destroy, gọi callback để manager `.delete(id)` (cần thêm `onInvalidated` callback HOẶC trực tiếp trong manager wrap).

  **Fix nhỏ**: Trong `bots-lite/index.js` `start()`, sau khi tạo `LiteClient`, thêm:
  ```js
  onError: ..., // giữ nguyên
  onFatal: () => { clients.delete(id) }, // mới
  ```
  Hoặc đơn giản hơn: listener `invalidated` trong LiteClient không cần xoá khỏi manager.clients — vì lần `start(id)` tiếp theo đã check `clients.get(id).isRunning()===false` rồi `clients.delete(id)` ([bots-lite/index.js:37-40](bots-lite/index.js#L37-L40)). KISS: không cần callback mới.

## Out of Scope (cố tình bỏ)
- Watchdog auto-restart (option C). Để user tự bấm "Khởi động lại tất cả" khi thấy đỏ. Nếu sau khi deploy vẫn xảy ra thường xuyên → add sau.
- Polling FE auto-refresh status. Hiện tại có nút "Làm mới" đủ dùng.
- Health metric / log dashboard.

## Unresolved Questions
Không có — scope đã rõ.
