// Admin command: tuy bien emoji badge cho tung tier (override default LEVEL_TIERS)
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js')
const db = require('../../../shared/db')
const { LEVEL_TIERS } = require('../services/level-service')
const { isValidBadge, applyTierFlair, getBadgeForTier } = require('../services/tier-flair-service')

// Choices tu LEVEL_TIERS (10 tier), value = minLevel
const TIER_CHOICES = LEVEL_TIERS.map(t => ({
  name: `${t.name} (lv ${t.minLevel}+)`,
  value: t.minLevel,
}))

module.exports = {
  data: new SlashCommandBuilder()
    .setName('flair-config')
    .setDescription('Quản lý emoji badge tuỳ biến cho các tier (chỉ admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Đặt emoji tuỳ biến cho 1 tier')
        .addIntegerOption(o =>
          o.setName('tier').setDescription('Tier cần custom').setRequired(true)
            .addChoices(...TIER_CHOICES))
        .addStringOption(o =>
          o.setName('emoji').setDescription('Unicode emoji (vd: 🦄, 💎)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Reset 1 tier về badge mặc định (bỏ trống tier để reset tất cả)')
        .addIntegerOption(o =>
          o.setName('tier').setDescription('Tier cần reset (bỏ trống = reset tất cả)')
            .addChoices(...TIER_CHOICES))
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('Xem danh sách badge của tất cả tier')
    )
    .addSubcommand(sub =>
      sub.setName('test')
        .setDescription('Gửi test: áp flair tier cho chính bạn để xem preview')
        .addIntegerOption(o =>
          o.setName('tier').setDescription('Tier muốn preview').setRequired(true)
            .addChoices(...TIER_CHOICES))
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true })
    const sub = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'set') {
      const tierMin = interaction.options.getInteger('tier')
      const emoji = interaction.options.getString('emoji').trim()
      if (!isValidBadge(emoji)) {
        return interaction.editReply(
          '❌ Emoji không hợp lệ. Chỉ chấp nhận Unicode emoji (không hỗ trợ custom server emoji như `<:name:id>`).'
        )
      }
      db.setTierBadge(guildId, tierMin, emoji)
      const tier = LEVEL_TIERS.find(t => t.minLevel === tierMin)
      return interaction.editReply(
        `✅ Đã đặt badge cho tier **${tier.name}** thành ${emoji}.\n` +
        `⚠️ Member đang ở tier này sẽ chỉ đổi nick khi lên tier mới. Dùng \`/flair-config test\` để xem preview ngay.`
      )
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
        const tag = custom ? '`(custom)`' : '`(mặc định)`'
        return `${active} **${t.name}** — lv ${t.minLevel}+ ${tag}`
      })
      const embed = new EmbedBuilder()
        .setTitle('🎖️ Badge tier hiện tại')
        .setDescription(lines.join('\n'))
        .setColor(0x5865f2)
      return interaction.editReply({ embeds: [embed] })
    }

    if (sub === 'test') {
      const tierMin = interaction.options.getInteger('tier')
      const tier = LEVEL_TIERS.find(t => t.minLevel === tierMin)
      const member = interaction.member
      const badge = getBadgeForTier(guildId, tier)
      // Truyen flair_enabled = 1 de bypass DB check (admin co the chua opt-in)
      const ok = await applyTierFlair(member, tierMin, { flair_enabled: 1 })
      return interaction.editReply(ok
        ? `✅ Đã áp flair tier **${tier.name}** ${badge} cho nickname của bạn. Chat thử để xem!`
        : `❌ Không áp được flair (bot có thể không sửa được nickname của bạn — owner/role hierarchy).`
      )
    }
  },
}
