const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db = require('../../../shared/db')
const { totalXpToReachLevel, levelFromXp } = require('../services/level-service')

const MAX_LEVEL = 100

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-level')
    .setDescription('Đặt level cho thành viên (admin)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Thành viên').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('level').setDescription(`Level mới (0-${MAX_LEVEL})`)
        .setMinValue(0).setMaxValue(MAX_LEVEL).setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('xp').setDescription('XP tùy chỉnh (bỏ trống = đặt đúng ngưỡng đầu level)')
        .setMinValue(0))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    const target = interaction.options.getUser('user')
    const level = interaction.options.getInteger('level')
    const xpInput = interaction.options.getInteger('xp')
    const guildId = interaction.guild.id

    // Tính xp mặc định = ngưỡng đầu của level, đảm bảo chat tiếp sẽ không bị tụt cấp
    const thresholdXp = totalXpToReachLevel(level)
    const xp = xpInput != null ? xpInput : thresholdXp

    // Cảnh báo nếu xp tùy chỉnh không khớp với level (sẽ bị tự điều chỉnh khi chat)
    const derivedLevel = levelFromXp(xp)
    const willDriftWarning = derivedLevel !== level
      ? `\n⚠️ XP ${xp} tương ứng level ${derivedLevel}, không khớp level ${level}. Khi user chat, level sẽ tự điều chỉnh về ${derivedLevel}.`
      : ''

    try {
      const existing = db.getUser(target.id, guildId)
      db.upsertUser({
        id: target.id,
        guild_id: guildId,
        xp,
        level,
        last_message_at: existing?.last_message_at ?? 0,
        username: target.username,
        global_name: target.globalName ?? null,
        avatar: target.avatar,
      })

      const oldInfo = existing
        ? `Lv ${existing.level} / ${existing.xp} XP`
        : '(chưa có dữ liệu)'

      await interaction.reply({
        content:
          `✅ Đã cập nhật **${target.tag}**\n` +
          `• Trước: ${oldInfo}\n` +
          `• Sau:   Lv ${level} / ${xp} XP` +
          willDriftWarning,
        ephemeral: true,
      })
    } catch (err) {
      console.error('[set-level]', err)
      await interaction.reply({ content: `❌ Lỗi: ${err.message}`, ephemeral: true })
    }
  },
}
