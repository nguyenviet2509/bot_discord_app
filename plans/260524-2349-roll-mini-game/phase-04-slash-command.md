---
phase: 4
title: "Slash Command"
status: pending
priority: P1
effort: "2h"
dependencies: [3]
---

# Phase 4: Slash Command

## Overview

Tạo `/roll-start` slash command, đăng ký button handler, cập nhật manifest.

## Requirements

**Functional:**
- `/roll-start so-nguoi-toi-da:int(2-100) thoi-han-phut:int(1-60)`
- Permission gate: `ManageGuild`
- Reject nếu guild đã có active session
- Tạo session DB, post embed public với 3 button, lưu message_id, set timer expire

**Non-functional:**
- Phản hồi ephemeral khi reject (không spam channel)
- Reply ephemeral confirm cho host khi tạo thành công (tránh duplicate noise vì đã post embed public)

## Architecture

```
commands/roll.js  →  /roll-start
  ├─ validate options + permission
  ├─ check active session/guild
  ├─ createSession (state=open)
  ├─ post embed public → setMessageId
  ├─ set timer onExpire
  └─ reply ephemeral

register.js  →  bind roll-button-handler
manifest.js  →  add 'roll-start' vào commands list
```

## Related Code Files

- **Create:** `bot/src/modules/mini-game/commands/roll.js`
- **Modify:**
  - `bot/src/modules/mini-game/register.js` (đăng ký roll-button-handler)
  - `bot/src/modules/mini-game/manifest.js` (thêm 'roll-start' vào commands)
- **Reference:**
  - `bot/src/modules/mini-game/commands/rps.js`

## Implementation Steps

### 4.1. `commands/roll.js`

```js
const { SlashCommandBuilder, PermissionsBitField } = require('discord.js')
const store = require('../services/roll-session-store')
const timeoutMgr = require('../services/roll-timeout')
const renderer = require('../services/roll-renderer')
const lifecycle = require('../services/roll-lifecycle')

const MAX_PLAYERS_LIMIT = 100
const SCORE_MAX_DEFAULT = 100
const MIN_MINUTES = 1
const MAX_MINUTES = 60

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll-start')
    .setDescription('Tạo session ROLL — random điểm 1-100 không trùng, top 1 thắng')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addIntegerOption(o => o.setName('so-nguoi-toi-da')
      .setDescription(`Số người tối đa (2-${MAX_PLAYERS_LIMIT}, mặc định ${MAX_PLAYERS_LIMIT})`)
      .setMinValue(2).setMaxValue(MAX_PLAYERS_LIMIT))
    .addIntegerOption(o => o.setName('thoi-han-phut')
      .setDescription(`Thời hạn đăng ký theo phút (${MIN_MINUTES}-${MAX_MINUTES}, mặc định 5)`)
      .setMinValue(MIN_MINUTES).setMaxValue(MAX_MINUTES)),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return interaction.reply({ content: 'Lệnh chỉ dùng trong server.', ephemeral: true })

    // Double-check permission (defaultMemberPermissions chỉ là gợi ý UI)
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: '🚫 Chỉ admin (ManageGuild) mới được tạo session.', ephemeral: true })
    }

    // 1 guild = 1 session active
    const active = store.getActiveSessionByGuild(guild.id)
    if (active) {
      return interaction.reply({
        content: `⚠️ Guild đã có session #${active.id} đang ${active.state}. Hủy session đó trước.`,
        ephemeral: true,
      })
    }

    const maxPlayers = interaction.options.getInteger('so-nguoi-toi-da') ?? MAX_PLAYERS_LIMIT
    const minutes = interaction.options.getInteger('thoi-han-phut') ?? 5
    const expiresAt = Math.floor(Date.now() / 1000) + minutes * 60

    const session = store.createSession({
      guildId: guild.id,
      channelId: interaction.channelId,
      hostId: interaction.user.id,
      maxPlayers,
      scoreMax: SCORE_MAX_DEFAULT,
      expiresAt,
    })

    // Post embed public
    const msg = await interaction.channel.send({
      embeds: [renderer.buildPendingEmbed({ session, participants: [], hostTag: interaction.user.username })],
      components: [renderer.buildPendingButtons(session.id, false)],
    })
    store.setMessageId(session.id, msg.id)

    // Set timer expire
    timeoutMgr.set(session.id, minutes * 60 * 1000, () => lifecycle.onExpire(interaction.client, session.id))

    return interaction.reply({
      content: `✅ Đã tạo ROLL Session #${session.id}. Hết hạn <t:${expiresAt}:R>.`,
      ephemeral: true,
    })
  },
}
```

### 4.2. Update `register.js`

```js
const rpsButtonHandler = require('./handlers/rps-button-handler')
const rollButtonHandler = require('./handlers/roll-button-handler')

module.exports = function register(_client, ctx) {
  ctx.buttonHandlers.push(rpsButtonHandler.handle)
  ctx.buttonHandlers.push(rollButtonHandler.handle)
}
```

### 4.3. Update `manifest.js`

```js
module.exports = {
  key: 'mini-game',
  name: 'Mini Game',
  description: 'RPS PvP + ROLL multi-player — mini-game cho server',
  defaultEnabled: false,
  commands: ['rps', 'coin', 'roll-start'],
}
```

### 4.4. Verify command được đăng ký Discord

Bot có script deploy slash commands (xem `bot/src/` để tìm). Sau khi sửa, chạy deploy script để Discord pick up command mới.

```bash
# Tìm script deploy
ls bot/src/ | grep -i deploy
# Hoặc bot tự register on ready — restart bot
```

### 4.5. Test cơ bản (manual)

1. Bot start → `/roll-start` xuất hiện trong Discord
2. User không phải admin gọi → reject
3. Admin gọi → embed post public, ephemeral confirm
4. Admin gọi lần 2 cùng guild → reject "đã có session active"
5. User khác bấm Tham gia → join, embed update (sau 1s debounce)
6. User bấm lại → leave
7. Admin bấm Bắt đầu khi < 2 → "cần ≥ 2 người"
8. ≥ 2 người, admin bấm Bắt đầu → result embed với ranking
9. Admin bấm Hủy → cancel embed

## Success Criteria

- [ ] `/roll-start` xuất hiện cho admin, ẩn cho user thường (Discord UI)
- [ ] Non-admin gọi qua API → reject ephemeral
- [ ] Active session check chính xác
- [ ] Embed public + ephemeral reply hoạt động
- [ ] Timer expire trigger đúng sau N phút
- [ ] Button handler được đăng ký, customId `mg:roll:*` route đúng

## Risk Assessment

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Slash command chưa deploy lên Discord | Medium | Script deploy hoặc restart bot |
| `defaultMemberPermissions` bị admin override permission Discord | Low | Double-check `memberPermissions.has(ManageGuild)` trong execute |
| Race: 2 admin /roll-start gần nhau | Low | `getActiveSessionByGuild` check + DB constraint (1 row state=open thường thấy bằng index) |
