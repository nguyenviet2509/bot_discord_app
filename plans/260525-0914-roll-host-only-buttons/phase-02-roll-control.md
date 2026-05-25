---
phase: 2
title: "/roll-control command + manifest + manual test"
status: pending
priority: P2
effort: "30m"
dependencies: [1]
---

# Phase 2: /roll-control Command

## Overview

Thêm slash command `/roll-control` để host re-open ephemeral với host buttons khi reload Discord. Update manifest + register. Manual test E2E.

## Related Code Files

**Create:**
- `bot/src/modules/mini-game/commands/roll-control.js`

**Modify:**
- `bot/src/modules/mini-game/manifest.js`

## Implementation Steps

### 2.1. `commands/roll-control.js`

```js
// Slash command /roll-control: host re-open ephemeral kèm Start/Cancel buttons.
// Dùng khi host reload Discord và mất ephemeral cũ.

const { SlashCommandBuilder, PermissionsBitField } = require('discord.js')
const store = require('../services/roll-session-store')
const renderer = require('../services/roll-renderer')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll-control')
    .setDescription('Mở lại bảng điều khiển ROLL session (chỉ host)')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return interaction.reply({ content: 'Lệnh chỉ dùng trong server.', ephemeral: true })

    const session = store.getActiveSessionByGuild(guild.id)
    if (!session) {
      return interaction.reply({
        content: '⚠️ Không có session ROLL nào đang active trong guild này.',
        ephemeral: true,
      })
    }

    if (interaction.user.id !== session.host_id) {
      return interaction.reply({
        content: `🚫 Chỉ host của session #${session.id} mới mở được bảng điều khiển.`,
        ephemeral: true,
      })
    }

    if (session.state !== 'open') {
      return interaction.reply({
        content: `⚠️ Session đang ở state '${session.state}', không cần điều khiển.`,
        ephemeral: true,
      })
    }

    return interaction.reply({
      content: `🎲 **Bảng điều khiển ROLL Session #${session.id}** (chỉ bạn thấy)\nHết hạn <t:${session.expires_at}:R>`,
      components: [renderer.buildHostButtons(session.id)],
      ephemeral: true,
    })
  },
}
```

### 2.2. Update `manifest.js`

```js
module.exports = {
  key: 'mini-game',
  name: 'Mini Game',
  description: 'Kéo Búa Bao PvP + ROLL multi-player — mini-game cho server.',
  defaultEnabled: false,
  commands: ['rps', 'coin', 'roll-start', 'roll-control'],
}
```

### 2.3. Compile check

```bash
node -e "require('./bot/src/modules/mini-game/commands/roll-control.js'); require('./bot/src/modules/mini-game/manifest.js'); console.log('OK')"
```

### 2.4. Manual test scenarios

| # | Kịch bản | Kỳ vọng |
|---|----------|---------|
| 1 | Admin gõ `/roll-start` | Public 1 nút Tham gia + ephemeral kèm 2 nút Start/Cancel |
| 2 | Member khác xem public message | Chỉ thấy 1 nút Tham gia |
| 3 | Member bấm Tham gia | Join thành công, embed update |
| 4 | Member gõ `/roll-control` | Reject "Chỉ host" |
| 5 | Host gõ `/roll-control` khi có active session | Ephemeral mở với 2 nút |
| 6 | Host bấm Bắt đầu trong ephemeral (≥ 2 người) | Public message → result embed |
| 7 | Host bấm Hủy trong ephemeral | Public message → cancel embed |
| 8 | Host reload Discord → ephemeral cũ mất → gõ `/roll-control` | Ephemeral mới mở, button work |
| 9 | Sau khi finish/cancel, host gõ `/roll-control` | Reject "Không có session active" |

## Success Criteria

- [ ] `/roll-control` xuất hiện trong Discord
- [ ] Non-host gõ → reject
- [ ] Host gõ khi có active session → ephemeral với buttons
- [ ] Buttons từ `/roll-control` work giống ephemeral gốc
- [ ] 9 scenario manual test pass

## Risk Assessment

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Slash command chưa propagate | Low | Guild-scoped đăng ký instant qua `applicationGuildCommands` |
| Host gõ `/roll-control` 2 lần → 2 ephemeral với 2 set buttons | Low | Cả 2 vẫn work, DB là source of truth, không corrupt |
