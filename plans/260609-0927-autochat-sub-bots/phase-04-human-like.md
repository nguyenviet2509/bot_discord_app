# Phase 04 — Human-like behavior

**Status:** pending
**Priority:** medium
**Depends on:** Phase 02
**Files:** `bots-lite/auto-chatter.js`, `shared/db-managed-bots.js`, `dashboard/routes/managed-bots.js`, `dashboard/public/index.html`

## Mục tiêu

Tin nhắn bot gửi giống tin nhắn người thật:
1. Hiển thị "đang nhập..." trước khi gửi, delay tỉ lệ độ dài
2. Không pick trùng câu vừa gửi (tránh "A → A → A")
3. Skip tick nếu channel im lặng quá lâu (tránh bot chat 1 mình)

Không jitter text, không quiet hours, không burst.

## Chi tiết

### 1. Typing indicator theo length

Trước `channel.send()`:

```js
await channel.sendTyping()
const msPerChar = 50 + Math.random() * 50  // 50-100ms/char random per send
const typingMs = Math.min(8000, Math.max(800, content.length * msPerChar))
await sleep(typingMs)
await channel.send(content)
```

- Cap 800ms..8s (Discord typing tự hết sau 10s, không cần renew)
- Không cần renew vì max 8s < 10s

### 2. Tránh trùng câu liên tiếp

Map in-memory `lastMessageId = new Map() // botId → last picked message id`.

```js
function pickMessage(botId, messages) {
  if (messages.length === 1) return messages[0]
  const lastId = lastMessageId.get(botId)
  const pool = messages.filter(m => m.id !== lastId)
  const picked = pool[Math.floor(Math.random() * pool.length)]
  lastMessageId.set(botId, picked.id)
  return picked
}
```

In-memory đủ — restart bot reset cũng OK (KISS, không cần persist).

### 3. Skip nếu channel im lặng quá lâu

Thêm cột DB:
```sql
ALTER TABLE managed_bots ADD COLUMN autochat_silence_skip_hours INTEGER NOT NULL DEFAULT 0
-- 0 = disabled, >0 = giờ ngưỡng
```

Trong tick, trước khi gửi:

```js
if (cfg.silence_skip_hours > 0) {
  const lastMsg = await channel.messages.fetch({ limit: 1 })
  const last = lastMsg.first()
  if (last) {
    const ageMs = Date.now() - last.createdTimestamp
    if (ageMs > cfg.silence_skip_hours * 3600 * 1000) {
      // im lặng quá lâu → skip, reschedule
      return scheduleNext(...)
    }
  }
}
```

Yêu cầu intent `GuildMessages` + scope `MESSAGE_HISTORY`. **LƯU Ý:** LiteClient hiện chỉ có intent `Guilds`. Cần thêm `GuildMessages` vào `lite-client.js` (chỉ khi feature này được dùng — hoặc đơn giản là luôn bật).

Trade-off: thêm intent → bot nhận message events (chỉ metadata, không nội dung vì không có `MessageContent` intent). OK, cost thấp.

### Cập nhật API/UI

API PUT autochat: thêm field `silence_skip_hours` (0..168, default 0).

UI: thêm input "Im lặng quá [__] giờ thì skip (0 = tắt)".

Helper DB: `getAutochatConfig` trả thêm `silence_skip_hours`. `updateAutochatConfig` whitelist thêm field này.

## Todo

- [ ] Thêm `sleep(ms)` helper trong auto-chatter
- [ ] Implement typing + delay theo length trong tick
- [ ] Thêm `lastMessageId` Map + `pickMessage()` 
- [ ] DB migration: thêm `autochat_silence_skip_hours`
- [ ] Update getAutochatConfig + updateAutochatConfig
- [ ] Implement silence check (fetch last msg, so sánh timestamp)
- [ ] Thêm `GatewayIntentBits.GuildMessages` vào lite-client.js
- [ ] API validation: silence_skip_hours ∈ [0, 168]
- [ ] UI input + persist
- [ ] Test: gửi message dài thấy typing lâu hơn; gửi liên tiếp không trùng; set silence_skip = 1h, để channel im 2h, bot skip

## Success criteria

- Channel hiện "bot đang nhập..." trước mỗi message
- Delay typing tỉ lệ độ dài (10 ký tự ~1s, 100 ký tự ~5-8s)
- Bắn 5 lần liên tiếp với 2 câu trong list → A,B,A,B,A (không bao giờ A,A)
- Set silence_skip=1, channel im 2h → log "skip: channel silent", không có message gửi đi
- Set silence_skip=0 → behavior cũ (không check)

## Câu hỏi chưa giải quyết

- Có cần edge case: list chỉ có 1 câu thì silence_skip có ý nghĩa không? (vẫn áp dụng — bot không spam nếu chỉ mình nó chat)
