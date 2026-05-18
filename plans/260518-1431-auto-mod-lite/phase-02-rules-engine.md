# Phase 2 — Rules Engine + State + 5 Rules

**Priority:** P0
**Status:** pending
**Effort:** 3 ngày
**Depends on:** Phase 1

## Context
- Module pattern: `bot/src/modules/mini-game/` (manifest + register + commands + services)
- Cần tích hợp với event `bot/src/events/message-create.js`

## Overview
Tạo module `auto-mod` với rules engine pipeline + in-memory state cho flood/repeat. Mỗi rule là 1 file riêng implement interface chuẩn. Module register vào `client._moduleMessageHandlers` (cần mở rộng `_loader.js`).

## Module structure

```
bot/src/modules/auto-mod/
├── manifest.js              # {key:'auto-mod', name, defaultEnabled:false, ...}
├── register.js              # push handler vào ctx.messageHandlers
├── rules-engine.js          # runRules(message, config) → {violated, rule, reason} | null
├── state.js                 # FloodTracker, RepeatTracker (Map TTL)
├── bad-word-cache.js        # Compile regex cache per-guild
└── rules/
    ├── anti-spam.js
    ├── anti-invite.js
    ├── bad-word.js
    ├── anti-mass-mention.js
    └── anti-repeat.js
```

## Rule interface

```js
// rules/anti-spam.js
module.exports = {
  name: 'anti-spam',
  defaultParams: { maxMessages: 5, windowSec: 5 },
  check(message, params, stateStore) {
    const key = `${message.guild.id}:${message.author.id}`
    const hits = stateStore.flood.push(key, Date.now(), params.windowSec * 1000)
    if (hits >= params.maxMessages) {
      return { violated: true, reason: `${hits} tin trong ${params.windowSec}s` }
    }
    return null
  }
}
```

## Loader extension

Mở rộng `bot/src/modules/_loader.js`:
- Khởi tạo `client._moduleMessageHandlers = []`
- Truyền `messageHandlers` array vào ctx của `register(client, ctx)`

## Register pattern (auto-mod/register.js)

```js
const dbAutomod = require('../../../../shared/db-automod')
const { runRules } = require('./rules-engine')
const state = require('./state')

module.exports = function register(client, ctx) {
  ctx.messageHandlers.push(async (message) => {
    if (message.author.bot || !message.guild) return false

    // Whitelist short-circuit (hot path)
    const roleIds = message.member?.roles?.cache?.map(r => r.id) || []
    if (dbAutomod.isWhitelisted(message.guild.id, message.channel.id, roleIds)) return false

    const config = dbAutomod.getConfig(message.guild.id)
    const result = runRules(message, config, state)
    if (!result) return false

    // Trả về thông tin vi phạm để action engine xử lý ở phase 3
    message._automodViolation = result
    return false  // chưa xử lý action ở phase này
  })
}
```

## State module (state.js)

```js
class FloodTracker {
  constructor() { this.buckets = new Map() }
  push(key, ts, windowMs) {
    let arr = this.buckets.get(key) || []
    const cutoff = ts - windowMs
    arr = arr.filter(t => t > cutoff)
    arr.push(ts)
    this.buckets.set(key, arr)
    return arr.length
  }
  // Cleanup interval (xóa key cũ mỗi 5 phút)
}

class RepeatTracker { ... }

module.exports = { flood: new FloodTracker(), repeat: new RepeatTracker() }
```

## Files
- **Create:**
  - `bot/src/modules/auto-mod/manifest.js`
  - `bot/src/modules/auto-mod/register.js`
  - `bot/src/modules/auto-mod/rules-engine.js`
  - `bot/src/modules/auto-mod/state.js`
  - `bot/src/modules/auto-mod/bad-word-cache.js`
  - `bot/src/modules/auto-mod/rules/anti-spam.js`
  - `bot/src/modules/auto-mod/rules/anti-invite.js`
  - `bot/src/modules/auto-mod/rules/bad-word.js`
  - `bot/src/modules/auto-mod/rules/anti-mass-mention.js`
  - `bot/src/modules/auto-mod/rules/anti-repeat.js`
- **Modify:**
  - `bot/src/modules/_loader.js` (thêm `_moduleMessageHandlers`)

## Implementation steps
1. Mở rộng `_loader.js` thêm `client._moduleMessageHandlers = []` và truyền vào ctx.
2. Tạo `manifest.js` (key='auto-mod', defaultEnabled=false).
3. Viết `state.js` 2 tracker với cleanup interval 5 phút.
4. Viết 5 rule files theo interface.
5. Viết `bad-word-cache.js` compile regex per-guild, invalidate khi config update.
6. Viết `rules-engine.js`:
   - Đọc config từ `dbAutomod.getConfig(guildId)`
   - Loop qua rules đã enabled, gọi `rule.check()`, return early khi violated.
7. Viết `register.js` push handler.
8. Test thủ công: enable rule qua sqlite trực tiếp → gửi tin spam → log thấy violation.

## Todo
- [ ] Mở rộng `_loader.js` với `messageHandlers`
- [ ] `manifest.js` + `register.js`
- [ ] `state.js` (FloodTracker, RepeatTracker, cleanup)
- [ ] `bad-word-cache.js` (compile + invalidate)
- [ ] 5 rule files
- [ ] `rules-engine.js` pipeline
- [ ] Smoke test: bật từng rule, gửi tin vi phạm → log

## Success criteria
- Mỗi rule chạy độc lập, có thể bật/tắt qua config
- Whitelist short-circuit hoạt động (admin role không bị check)
- Latency rules-engine < 30ms (đo bằng `console.time`)
- State cleanup không leak memory sau 1h chạy

## Risks
- **Regex bad-word user-input crash:** Wrap `new RegExp` trong try-catch, log + skip rule
- **State memory leak:** Cleanup interval bắt buộc, test bằng heapdump nếu cần
- **Mention count đếm sai:** Dùng `message.mentions.users.size + message.mentions.roles.size`, không dùng regex `<@`
