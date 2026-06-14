---
phase: 2
title: Bot voice event handler
status: completed
priority: P1
effort: 45m
dependencies:
  - 1
---

# Phase 2: Bot voice event handler

## Overview

Bật intent `GuildVoiceStates` và tạo handler `voice-state-update.js` để xử lý join/leave/switch trong whitelist, gửi thông báo vào notify channel.

## Requirements

**Functional:**
- Skip bot users
- Skip khi oldChannelId === newChannelId (mute/deafen state changes)
- Leave: `oldChannelId != null` và old trong whitelist
- Join: `newChannelId != null` và new trong whitelist
- Switch A→B với cả 2 trong whitelist → gửi 2 message (leave A trước, join B sau)
- Switch A→B với chỉ 1 trong whitelist → gửi 1 message tương ứng
- Channels không trong whitelist → im lặng
- Render placeholders: `{user}` → `<@id>`, `{username}` → display name, `{channel}` → tên voice, `{time}` → HH:mm theo TZ Asia/Ho_Chi_Minh

**Non-functional:**
- File ≤ 100 LOC
- Lỗi fetch channel → log warn, không crash
- `allowedMentions` chỉ chứa user vừa thao tác

## Architecture

Event `voiceStateUpdate(oldState, newState)` từ discord.js. So sánh `oldState.channelId` vs `newState.channelId`, kết hợp whitelist trong cấu hình → quyết định gửi leave/join/cả 2.

## Related Code Files

- Modify: `bot/src/index.js` (thêm intent `GuildVoiceStates`)
- Create: `bot/src/events/voice-state-update.js`

## Implementation Steps

1. **Mở `bot/src/index.js`**, trong mảng `intents` (line ~21), thêm `GatewayIntentBits.GuildVoiceStates`.
2. **Tạo `bot/src/events/voice-state-update.js`**:
   ```js
   const db = require('../../../shared/db')

   module.exports = {
     name: 'voiceStateUpdate',
     async execute(oldState, newState) {
       const member = newState.member || oldState.member
       if (!member || member.user.bot) return
       const oldCh = oldState.channelId
       const newCh = newState.channelId
       if (oldCh === newCh) return

       const guild = newState.guild || oldState.guild
       const cfg = db.getVoiceLogSettings(guild.id)
       if (!cfg.enabled || !cfg.notify_channel_id) return

       const notifyChannel = guild.channels.cache.get(cfg.notify_channel_id)
         || await guild.channels.fetch(cfg.notify_channel_id).catch(() => null)
       if (!notifyChannel) {
         console.warn(`[VoiceLog] notify channel ${cfg.notify_channel_id} not found`)
         return
       }

       const watched = cfg.watched_channels || []
       if (oldCh && watched.includes(oldCh)) {
         const ch = oldState.channel || await guild.channels.fetch(oldCh).catch(() => null)
         if (ch) await safeSend(notifyChannel, cfg.leave_template, member, ch)
       }
       if (newCh && watched.includes(newCh)) {
         const ch = newState.channel || await guild.channels.fetch(newCh).catch(() => null)
         if (ch) await safeSend(notifyChannel, cfg.join_template, member, ch)
       }
     },
   }

   async function safeSend(notifyChannel, template, member, channel) {
     try {
       const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
       const content = template
         .replace(/\{user\}/g, `<@${member.id}>`)
         .replace(/\{username\}/g, member.displayName || member.user.username)
         .replace(/\{channel\}/g, channel.name)
         .replace(/\{time\}/g, time)
       await notifyChannel.send({ content, allowedMentions: { users: [member.id] } })
     } catch (err) {
       console.error('[VoiceLog] send fail:', err.message)
     }
   }
   ```
3. Event tự động được load bởi loop `client.on(event.name, ...)` trong `bot/src/index.js`.
4. **Compile check**: `node -c bot/src/events/voice-state-update.js`.
5. Khởi động bot, log xác nhận không có warning về missing intent.

## Success Criteria

- [ ] Intent `GuildVoiceStates` xuất hiện trong array `intents` của client
- [ ] File `bot/src/events/voice-state-update.js` exports đúng `{ name: 'voiceStateUpdate', execute }`
- [ ] Bot khởi động không lỗi
- [ ] Khi disabled hoặc notify_channel_id null → 0 message gửi
- [ ] Khi whitelist rỗng → 0 message gửi

## Risk Assessment

- **Risk**: `member.displayName` undefined trên partial member → fallback `member.user.username`
- **Risk**: notify channel bị xoá → fetch trả null → guard sẵn, log warn
- **Risk**: voice channel bị xoá giữa lúc event firing → fetch fail → guard sẵn

## Security Considerations

- `allowedMentions: { users: [member.id] }` ngăn template chứa `@everyone` bị Discord render mass-ping
- Template do admin nhập qua dashboard đã auth, không sanitize thêm
