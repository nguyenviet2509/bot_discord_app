# Phase 2 — Module skeleton + handler (mask + webhook repost)

**Status:** pending
**Effort:** 1.5 ngày
**Priority:** P0

## Overview

Tạo module `word-filter` theo pattern `bot/src/modules/auto-mod/`:
- `manifest.js` — declare module
- `register.js` — push messageHandler vào ctx
- `handler.js` — main logic: match → delete → repost
- `regex-cache.js` — cache regex compile per-guild
- `webhook-cache.js` — cache `WebhookClient` per-channel
- `mask.js` — replace match → `***`

## Folder structure

```
bot/src/modules/word-filter/
├── manifest.js
├── register.js
├── handler.js
├── regex-cache.js
├── webhook-cache.js
└── mask.js
```

## manifest.js

```js
module.exports = {
  key: 'word-filter',
  name: 'Ẩn từ nhạy cảm',
  description: 'Phát hiện từ trong blacklist trong tin member, xoá tin gốc và repost qua webhook với từ bị mask thành ***.',
  defaultEnabled: false,
  commands: [],
}
```

## regex-cache.js (KISS — fork pattern từ bad-word-cache)

Pattern: `\b(word1|word2|...)\b`, flag `iu`. Cache `Map<guildId, { signature, regex }>`. Export `get(guildId, words)` + `invalidate(guildId)`.

Lý do **không** dùng chung `auto-mod/bad-word-cache.js`: cross-module coupling, dễ break khi auto-mod đổi cache key. Duplicate ~20 dòng — chấp nhận (DRY violation nhỏ, đổi lại tính độc lập module).

## mask.js

```js
// Mask cố định 3 sao (KISS, không tiết lộ độ dài).
module.exports = function maskContent(content, regex) {
  return content.replace(regex, '***')
}
```

## webhook-cache.js

```js
// Cache WebhookClient per channelId, lazy create lần đầu.
// channel.fetchWebhooks() → tìm webhook tên 'WordFilter' do bot tạo.
// Nếu không có → channel.createWebhook({ name: 'WordFilter', reason: '...' }).
// Trả về WebhookClient hoặc null nếu thiếu perm.

exports.getOrCreate = async (channel) => WebhookClient | null
exports.invalidateChannel = (channelId) => void
```

Edge:
- Channel là Thread → dùng `channel.parent` để fetch/create webhook, return `{ webhook, threadId: channel.id }`.
- Forum channel: tương tự thread.

## handler.js

Pseudocode:

```js
async function handleMessage(message) {
  if (!message.guild) return false
  if (message.author.bot || message.webhookId) return false  // chống loop
  if (!dbMiniGame.isModuleEnabled(message.guild.id, 'word-filter')) return false

  const cfg = dbWordFilter.getConfig(message.guild.id)
  if (!cfg.enabled || cfg.words.length === 0) return false

  const regex = regexCache.get(message.guild.id, cfg.words)
  if (!regex) return false

  const content = message.content || ''
  if (!regex.test(content)) return false
  regex.lastIndex = 0  // reset nếu global flag (không có ở đây, defensive)

  // Match → process
  const masked = maskContent(content, regex)

  // 1. Delete tin gốc (catch 10008 Unknown Message khi auto-mod đã xoá)
  try { await message.delete() }
  catch (e) { if (e.code !== 10008) console.warn('[word-filter] delete fail:', e.message); return false }

  // 2. Repost qua webhook
  const wh = await webhookCache.getOrCreate(message.channel)
  if (!wh) {
    logMissingPerm(message.guild.id)  // throttle 1/giờ/guild
    return true  // tin đã xoá, không repost được
  }

  const isThread = message.channel.isThread?.()
  try {
    await wh.webhook.send({
      username:  message.member?.displayName || message.author.username,
      avatarURL: message.member?.displayAvatarURL?.() || message.author.displayAvatarURL(),
      content:   prependReplyHint(message, masked),
      allowedMentions: { parse: [] },
      threadId:  isThread ? message.channel.id : undefined,
    })
  } catch (e) {
    if (e.code === 10015) {  // Unknown Webhook → invalidate cache, retry 1 lần
      webhookCache.invalidateChannel(message.channel.id)
    } else {
      console.warn('[word-filter] webhook send fail:', e.message)
    }
  }

  return true  // tin đã xử lý, các handler khác không cần chạy
}

function prependReplyHint(message, content) {
  const ref = message.reference
  if (!ref) return content
  // Best-effort: chỉ note có reply, không fetch tin gốc (cost)
  return `↪ (trả lời)\n${content}`
}
```

## register.js

```js
const dbMiniGame = require('../../../../shared/db-mini-game')
const dbWordFilter = require('../../../../shared/db-word-filter')
const handler = require('./handler')

module.exports = function register(client, ctx) {
  ctx.messageHandlers.push(async (message) => {
    try {
      return await handler(message, { dbMiniGame, dbWordFilter })
    } catch (err) {
      console.error('[word-filter] handler loi:', err.message)
      return false
    }
  })
}
```

## Thứ tự handler với auto-mod

Cả 2 module push vào cùng `client._moduleMessageHandlers`. Thứ tự load = alphabetic (theo `_loader.js` đọc dir): `auto-mod` < `word-filter`.

→ auto-mod chạy trước. Nếu auto-mod xoá tin (bad-word/anti-invite/...), word-filter gọi `message.delete()` sẽ throw `10008` → catch im lặng, return false (không repost gì cả). **Hành vi đúng**: tin đã bị phạt bởi auto-mod thì không cần ẩn từ nữa.

## Related files

**Create:**
- `bot/src/modules/word-filter/manifest.js`
- `bot/src/modules/word-filter/register.js`
- `bot/src/modules/word-filter/handler.js`
- `bot/src/modules/word-filter/regex-cache.js`
- `bot/src/modules/word-filter/webhook-cache.js`
- `bot/src/modules/word-filter/mask.js`

**Modify:** không (loader tự pickup folder mới).

## Todo

- [ ] manifest.js
- [ ] regex-cache.js (port từ bad-word-cache, đổi tên)
- [ ] mask.js (1 hàm)
- [ ] webhook-cache.js (getOrCreate + invalidate, handle thread/forum)
- [ ] handler.js (main pipeline với try/catch đầy đủ)
- [ ] register.js (push handler)
- [ ] Test thủ công: bật module qua DB → gửi tin chứa từ → kiểm tra webhook repost OK
- [ ] Test loop prevention: webhook message không trigger handler lại
- [ ] Test race với auto-mod: bật cả 2 module cùng từ → không crash

## Success criteria

- Member gửi tin chứa "abc" → tin biến mất → webhook repost với mask `***`
- Avatar + tên hiển thị đúng user gốc (kèm badge APP)
- @everyone trong tin không re-ping
- Thread channel hoạt động đúng
- Thiếu `Manage Webhooks` → log warn 1 lần, tin chỉ bị xoá (không repost)

## Risks

- **Webhook tên `WordFilter` trùng với webhook user đã tạo thủ công:** `fetchWebhooks` filter theo `name === 'WordFilter' && owner.id === client.user.id` để chỉ dùng webhook do bot tạo.
- **Channel xoá webhook giữa chừng:** retry 1 lần (đã handle code 10015).

## Next

→ Phase 3: dashboard API + UI để admin config.
