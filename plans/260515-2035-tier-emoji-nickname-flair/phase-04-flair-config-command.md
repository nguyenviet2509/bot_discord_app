# Phase 4 — Slash Command `/flair-config` (Admin Custom Badge)

**Priority:** Medium
**Status:** pending
**Effort:** ~30 min
**Depends on:** Phase 1

## Overview
Slash command cho admin (permission `ManageGuild`) custom emoji badge cho từng tier per-guild. Subcommands: `set`, `reset`, `view`.

## Related Files
- **Create:** `bot/src/commands/flair-config.js`.

## Implementation Steps

### 4.1 Command structure
```js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js')
const db = require('../../../shared/db')
const { LEVEL_TIERS } = require('../services/level-service')
const { isValidBadge } = require('../services/tier-flair-service')

// Choices từ LEVEL_TIERS (10 tier)
const TIER_CHOICES = LEVEL_TIERS.map(t => ({
  name: `${t.name} (lv ${t.minLevel}+)`,
  value: t.minLevel,
}))

module.exports = {
  data: new SlashCommandBuilder()
    .setName('flair-config')
    .setDescription('Quản lý emoji badge tùy biến cho các tier')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Đặt emoji tùy biến cho 1 tier')
        .addIntegerOption(o =>
          o.setName('tier').setDescription('Tier cần custom').setRequired(true).addChoices(...TIER_CHOICES))
        .addStringOption(o =>
          o.setName('emoji').setDescription('Unicode emoji (vd: 🦄, 💎)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Reset 1 tier về badge mặc định hoặc reset tất cả')
        .addIntegerOption(o =>
          o.setName('tier').setDescription('Tier cần reset (bỏ trống = reset tất cả)').addChoices(...TIER_CHOICES))
    )
    .addSubcommand(sub =>
      sub.setName('view').setDescription('Xem danh sách badge của tất cả tier')
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true })
    const sub = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'set') {
      const tierMin = interaction.options.getInteger('tier')
      const emoji = interaction.options.getString('emoji').trim()
      if (!isValidBadge(emoji)) {
        return interaction.editReply('❌ Emoji không hợp lệ. Chỉ chấp nhận Unicode emoji (không hỗ trợ custom server emoji như `<:name:id>`).')
      }
      db.setTierBadge(guildId, tierMin, emoji)
      const tier = LEVEL_TIERS.find(t => t.minLevel === tierMin)
      return interaction.editReply(`✅ Đã đặt badge cho tier **${tier.name}** thành ${emoji}.`)
    }

    if (sub === 'reset') {
      const tierMin = interaction.options.getInteger('tier')
      db.resetTierBadge(guildId, tierMin ?? null)
      if (tierMin == null) {
        return interaction.editReply('✅ Đã reset tất cả tier về badge mặc định.')
      }
      const tier = LEVEL_TIERS.find(t => t.minLevel === tierMin)
      return interaction.editReply(`✅ Đã reset tier **${tier.name}** về badge mặc định.`)
    }

    if (sub === 'view') {
      const overrides = db.getTierBadgeOverrides(guildId)
      const lines = LEVEL_TIERS.map(t => {
        const custom = overrides.get(t.minLevel)
        const active = custom || t.badge
        const tag = custom ? '(custom)' : '(mặc định)'
        return `${active} **${t.name}** — lv ${t.minLevel}+ ${tag}`
      })
      const embed = new EmbedBuilder()
        .setTitle('🎖️ Badge tier hiện tại')
        .setDescription(lines.join('\n'))
        .setColor(0x5865f2)
      return interaction.editReply({ embeds: [embed] })
    }
  },
}
```

### 4.2 Lưu ý
- `setDefaultMemberPermissions(ManageGuild)` → Discord tự ẩn command với non-admin.
- Validate emoji ở client-side qua `isValidBadge` (regex Unicode emoji, length ≤ 8).
- Override mới **chỉ áp dụng từ lần level-up tiếp theo**. Member đã có nick badge cũ không tự đổi (chấp nhận; tránh batch update gây spam). Phase 5 có thể thêm command sync nếu cần.

## Todo
- [ ] Tạo `bot/src/commands/flair-config.js`
- [ ] Verify auto-load
- [ ] Deploy slash commands
- [ ] Test 3 subcommand: set / reset / view
- [ ] Test reject custom emoji `<:name:id>` và string lung tung

## Success Criteria
- Admin set tier "Sắt" emoji `🦄` → DB lưu override, `/flair-config view` hiển thị `🦄 Sắt (custom)`.
- Member chạm tier mới sau khi override → nick có emoji custom.
- Non-admin không thấy command.

## Risks
- Override không retro-apply cho member đã ở tier đó → ghi rõ trong reply hoặc thêm sync command sau.
