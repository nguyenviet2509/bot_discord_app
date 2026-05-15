// User command: bat/tat tier flair (emoji kem ten trong nickname)
const { SlashCommandBuilder } = require('discord.js')
const db = require('../../../shared/db')
const { applyTierFlair, removeFlair } = require('../services/tier-flair-service')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('flair')
    .setDescription('Bật / tắt emoji tier kèm tên trong server')
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
        return interaction.editReply(
          'Đã bật flair. Cần đạt level 10 (tier Sắt) để hiển thị emoji kèm tên.'
        )
      }
      const ok = await applyTierFlair(member, user.level, { ...user, flair_enabled: 1 })
      return interaction.editReply(ok
        ? 'Đã bật flair ✓ Emoji tier đã thêm vào nickname của bạn.'
        : 'Đã bật flair nhưng bot không sửa được nickname (kiểm tra permission hoặc role hierarchy).'
      )
    }

    // Opt-out: strip emoji ngay
    const ok = await removeFlair(member)
    return interaction.editReply(ok
      ? 'Đã tắt flair ✓ Emoji đã được gỡ khỏi nickname.'
      : 'Đã tắt flair (bot không sửa được nickname, vui lòng tự gỡ emoji nếu muốn).'
    )
  },
}
