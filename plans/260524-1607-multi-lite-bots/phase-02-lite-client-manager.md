# Phase 02: Lite Client + Manager

**Status:** pending | **Effort:** 2.5h | **Priority:** high
**Depends on:** Phase 01

## Context
Manager giữ Map các `LiteClient` đang chạy. Lazy: chỉ login khi gọi `start(id)`. Không listen event nghiệp vụ.

## Files
**Create:**
- `bots-lite/lite-client.js` — wrapper 1 Discord Client tối giản
- `bots-lite/index.js` — manager singleton (start/stop/update/list)
- `bots-lite/package.json` (nếu cần workspace riêng, hoặc dùng root deps)

## Design
### LiteClient
```js
class LiteClient {
  constructor({ id, token, displayName, avatarUrl, presenceStatus, activityType, activityText, onError })
  async start()       // login + on ready apply identity + presence
  async stop()        // client.destroy()
  async applyIdentity({ displayName?, avatarUrl? })  // setUsername/setAvatar (chỉ khi khác)
  applyPresence({ presenceStatus, activityType, activityText })  // setPresence
  isRunning()
}
```

### Manager (bots-lite/index.js)
```js
// Singleton
const clients = new Map(); // id → LiteClient

async function start(db, id) { /* load row, decrypt token, new LiteClient, await start, updateStatus running */ }
async function stop(db, id)  { /* clients.get(id)?.stop(), updateStatus stopped */ }
async function applyChanges(db, id, patch) { /* nếu running → applyIdentity/applyPresence */ }
function getStatus(id)       { /* running|stopped */ }
function listRunning()       { /* array of ids */ }
async function stopAll()     { /* graceful shutdown */ }
```

## Steps
1. Verify discord.js version trong `bot/package.json` (cần v14+)
2. Tạo `bots-lite/lite-client.js`:
   - Import `Client`, `GatewayIntentBits`, `ActivityType` từ discord.js
   - Intents: chỉ `Guilds` (tối thiểu để bot online)
   - `start()`: `client.login(token)`, await `ready` event, gọi `applyIdentity` + `applyPresence`
   - `applyIdentity`: so sánh `client.user.username` ≠ `displayName` thì `setUsername()`; avatar tương tự (fetch current vs target URL)
   - `applyPresence`: map `activityType` string → `ActivityType` enum, gọi `client.user.setPresence({ status, activities: [{ type, name }] })`
   - Wrap mọi async trong try/catch, gọi `onError(err)` callback
3. Tạo `bots-lite/index.js` manager với Map + functions trên
4. Username rate limit guard: trước khi `setUsername`, check `last_username_change` ≥ 30 phút trước, nếu không skip + log warning
5. Avatar URL → fetch buffer → pass vào `setAvatar(buffer)` (discord.js chấp nhận buffer hoặc URL)
6. Smoke test với 1 token thật (manual, không commit token)

## Todo
- [ ] Verify discord.js version
- [ ] Implement `lite-client.js` (<200 LOC)
- [ ] Implement `index.js` manager
- [ ] Test start/stop với 1 bot thật
- [ ] Test applyChanges runtime (đổi name → kiểm Discord)
- [ ] Test rate limit guard trigger đúng

## Success Criteria
- `start(db, id)` → bot online trong Discord trong ≤5s
- `stop(db, id)` → bot offline trong ≤2s
- `applyChanges` với activity_text mới → Discord update trong ≤3s
- Crash 1 client KHÔNG kéo process exit (catch error)
- DB status sync đúng với runtime state

## Risks
- `ActivityType.Custom` không hiển thị cho bot → test sớm, document trong code comment, default fallback `Playing`
- Token invalid → login throw, manager catch → set `status=error`, `last_error=msg`
- Avatar URL fetch fail → log + skip, không crash

## Next
→ Phase 03: expose qua HTTP API cho dashboard
