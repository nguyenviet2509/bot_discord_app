---
phase: 3
title: Dashboard backend routes
status: completed
priority: P1
effort: 45m
dependencies:
  - 1
---

# Phase 3: Dashboard backend routes

## Overview

Tạo 2 route Express:
1. `/api/voice-log` (GET/PUT) — đọc/ghi `voice_log_settings`
2. `/api/discord/channels` (GET) — trả về danh sách voice channels + text channels của guild để UI render dropdown/checkbox

## Requirements

**Functional:**
- GET `/api/voice-log` → trả về cấu hình hiện tại (default object nếu chưa có row)
- PUT `/api/voice-log` body `{ enabled, notify_channel_id, watched_channels, join_template, leave_template }` → validate + upsert
- GET `/api/discord/channels` → `[{ id, name, type: 'voice'|'text' }]`, sort theo position
- Cả 2 route đều behind `auth` middleware (như các route khác trong `dashboard/server.js`)

**Validation `/api/voice-log` PUT:**
- `enabled` coerce → 0/1
- `notify_channel_id` nullable string
- `watched_channels` phải là array of string ID
- `join_template`, `leave_template` non-empty strings, max 1500 chars

**Non-functional:**
- Reuse pattern fetch Discord API như `discord-roles.js`
- File mỗi route ≤ 100 LOC

## Architecture

`/api/discord/channels` fetch `https://discord.com/api/v10/guilds/{GUILD_ID}/channels`, filter:
- type === 2 (GUILD_VOICE) → `type: 'voice'`
- type === 0 (GUILD_TEXT) → `type: 'text'`
- type === 5 (GUILD_ANNOUNCEMENT) → `type: 'text'` (cũng cho phép gửi)
Bỏ qua category, forum, stage, thread.

## Related Code Files

- Modify: `dashboard/server.js` (mount 2 route mới)
- Create: `dashboard/routes/voice-log.js`
- Create: `dashboard/routes/discord-channels.js`

## Implementation Steps

1. **Tạo `dashboard/routes/voice-log.js`**:
   ```js
   const express = require('express')
   const db = require('../../shared/db')

   const router = express.Router()
   const GUILD_ID = () => process.env.GUILD_ID

   router.get('/', (req, res) => {
     const cfg = db.getVoiceLogSettings(GUILD_ID())
     res.json({ ...cfg, enabled: !!cfg.enabled })
   })

   router.put('/', (req, res) => {
     const { enabled, notify_channel_id, watched_channels, join_template, leave_template } = req.body
     if (!join_template || !join_template.trim()) return res.status(400).json({ error: 'Mẫu tin nhắn JOIN không được rỗng' })
     if (!leave_template || !leave_template.trim()) return res.status(400).json({ error: 'Mẫu tin nhắn LEAVE không được rỗng' })
     if (join_template.length > 1500 || leave_template.length > 1500) return res.status(400).json({ error: 'Mẫu tin nhắn tối đa 1500 ký tự' })
     if (watched_channels && !Array.isArray(watched_channels)) return res.status(400).json({ error: 'watched_channels phải là array' })

     db.upsertVoiceLogSettings({
       guild_id: GUILD_ID(),
       enabled: enabled ? 1 : 0,
       notify_channel_id: notify_channel_id || null,
       watched_channels: (watched_channels || []).map(String),
       join_template: join_template.trim(),
       leave_template: leave_template.trim(),
     })
     res.json({ success: true })
   })

   module.exports = router
   ```

2. **Tạo `dashboard/routes/discord-channels.js`** (theo pattern `discord-roles.js`):
   ```js
   const express = require('express')
   const router = express.Router()

   router.get('/', async (req, res) => {
     res.set('Cache-Control', 'no-store')
     const guildId = process.env.GUILD_ID
     const token = process.env.BOT_TOKEN
     if (!guildId || !token) return res.status(500).json({ error: 'GUILD_ID/BOT_TOKEN chưa cấu hình' })
     try {
       const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
         headers: { Authorization: `Bot ${token}` },
       })
       if (!r.ok) return res.status(502).json({ error: 'Không lấy được channels' })
       const channels = await r.json()
       const out = channels
         .filter(c => c.type === 0 || c.type === 2 || c.type === 5)
         .map(c => ({ id: c.id, name: c.name, type: c.type === 2 ? 'voice' : 'text', position: c.position }))
         .sort((a, b) => a.position - b.position)
       res.json(out)
     } catch (err) {
       console.error('[discord-channels]', err.message)
       res.status(500).json({ error: 'Lỗi server' })
     }
   })

   module.exports = router
   ```

3. **Modify `dashboard/server.js`** — thêm 2 dòng sau các `app.use('/api/...', auth, require(...))` hiện có:
   ```js
   app.use('/api/voice-log', auth, require('./routes/voice-log'))
   app.use('/api/discord/channels', auth, require('./routes/discord-channels'))
   ```

4. **Test thủ công** (sau khi dashboard chạy):
   ```bash
   # Lấy token từ login flow rồi:
   curl -H "Authorization: Bearer <token>" http://localhost:3001/api/voice-log
   curl -H "Authorization: Bearer <token>" http://localhost:3001/api/discord/channels
   ```

## Success Criteria

- [ ] GET `/api/voice-log` (chưa có data) → default object có `enabled: false`, `watched_channels: []`
- [ ] PUT `/api/voice-log` với payload hợp lệ → 200 `{success: true}`, GET sau đó trả đúng giá trị vừa lưu
- [ ] PUT với `join_template` rỗng → 400 với message tiếng Việt
- [ ] GET `/api/discord/channels` trả ≥ 1 voice channel + ≥ 1 text channel của server (qua bot token)
- [ ] Route đều bảo vệ bởi `auth` (gọi không có token → 401)

## Risk Assessment

- **Risk**: bot không có permission `View Channels` cho 1 số channel → API Discord ẩn → không list được. Chấp nhận, admin invite bot lại với scope đầy đủ.
- **Risk**: Race khi nhiều admin PUT cùng lúc → SQLite serialize ghi, last write wins. OK cho usecase admin.

## Security Considerations

- Cả 2 route behind `auth` middleware — không expose bot token ra client
- `watched_channels` được map String → ngăn injection số/object lạ
