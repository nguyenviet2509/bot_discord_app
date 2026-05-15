# Phase 3 — Slash Command `/flair`

**Priority:** Medium
**Status:** pending
**Effort:** ~20 min
**Depends on:** Phase 1

## Overview
Slash command để user tự bật/tắt flair. Khi tắt → bot strip emoji khỏi nick ngay.

## Related Files
- **Create:** `bot/src/commands/flair.js`.

## Implementation Steps

### 3.1 Command structure
File `bot/src/commands/flair.js`:
```js
const { SlashCommandBuilder } = require('discord.js')
const db = require('../../../shared/db')
const { applyTierFlair, removeFlair } = require('../services/tier-flair-service')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('flair')
    .setDescription('Bật/tắt emoji tier kèm tên trong server')
    .addStringOption(opt =>
      opt.setName('mode')
        .setDescription('Bật hoặc tắt flair')
        .setRequired(true)
        .addChoices(
          { name: 'Bật', value: 'on' },
          { name: 'Tắt', value: 'off' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true })
    const mode = interaction.options.getString('mode')
    const guildId = interaction.guild.id
    const userId = interaction.user.id
    const member = interaction.member

    const enabled = mode === 'on'
    db.setFlairEnabled(userId, guildId, enabled)

    if (enabled) {
      const user = db.getUser(userId, guildId)
      if (!user || user.level < 10) {
        return interaction.editReply('Đã bật flair. Cần đạt level 10 (tier Sắt) để hiện emoji.')
      }
      const ok = await applyTierFlair(member, user.level, { ...user, flair_enabled: 1 })
      return interaction.editReply(ok
        ? 'Đã bật flair. Emoji tier đã thêm vào nickname của bạn.'
        : 'Đã bật flair nhưng bot không sửa được nickname (kiểm tra permission/role hierarchy).'
      )
    } else {
      const ok = await removeFlair(member)
      return interaction.editReply(ok
        ? 'Đã tắt flair. Emoji đã được gỡ khỏi nickname.'
        : 'Đã tắt flair (bot không sửa được nickname, hãy tự gỡ emoji nếu muốn).'
      )
    }
  },
}
```

### 3.2 Đăng ký command
Kiểm tra cách load commands hiện tại (loader tự đọc thư mục `commands/`). Nếu auto-load → không cần thêm gì. Verify bằng cách so sánh với command tương tự (vd: `rank.js`).

Deploy commands: chạy script deploy slash command hiện có (nếu bot dùng script riêng để register globally/guild).

## Todo
- [ ] Tạo `bot/src/commands/flair.js`
- [ ] Verify loader auto-pick file mới (xem `bot/src/index.js`)
- [ ] Deploy slash commands (nếu cần script register)
- [ ] Test: user lv 50 dùng `/flair off` → nick bị strip
- [ ] Test: user dùng `/flair on` → nick được set lại với emoji tier hiện tại
- [ ] Test: user lv 5 dùng `/flair on` → reply "cần đạt lv 10"

## Success Criteria
- Command xuất hiện trong Discord slash menu.
- Toggle DB flag `flair_enabled` đúng.
- Apply / strip emoji immediate sau toggle.

## Risks
- Nếu bot dùng global commands → cần thời gian propagate (~1h). Dùng guild commands trong dev.
