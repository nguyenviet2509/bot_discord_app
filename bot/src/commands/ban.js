const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db = require('../../../shared/db')
const { parseDuration, formatDuration } = require('../utils/parse-duration')
const logModAction = require('../utils/log-mod-action')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban một thành viên (có thể đặt thời hạn)')
    .addUserOption(opt => opt.setName('user').setDescription('Thành viên cần ban').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Thời hạn (vd: 30m, 2h, 7d). Bỏ trống = ban vĩnh viễn'))
    .addStringOption(opt => opt.setName('reason').setDescription('Lý do'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user')
    const durationStr = interaction.options.getString('duration')
    const reason = interaction.options.getString('reason') || 'Không có lý do'

    let durationMs = null
    if (durationStr) {
      durationMs = parseDuration(durationStr)
      if (!durationMs) {
        return interaction.reply({
          content: '❌ Định dạng thời gian sai. Dùng: `30m`, `2h`, `7d` (s/m/h/d).',
          ephemeral: true,
        })
      }
    }

    try {
      await interaction.guild.members.ban(user.id, { reason })
      const expiresAt = durationMs ? Math.floor((Date.now() + durationMs) / 1000) : null
      if (durationMs) db.addTempBan(interaction.guild.id, user.id, expiresAt, reason)
      logModAction(interaction, {
        action_type: 'ban', user, reason,
        duration_ms: durationMs, expires_at: expiresAt,
      })
      if (durationMs) {
        await interaction.reply(
          `🔨 Đã ban **${user.tag}** trong **${formatDuration(durationMs)}**.\n📝 Lý do: ${reason}\n⏰ Tự unban: <t:${expiresAt}:R>`
        )
      } else {
        await interaction.reply(`🔨 Đã ban vĩnh viễn **${user.tag}**.\n📝 Lý do: ${reason}`)
      }
    } catch (err) {
      console.error('[ban]', err)
      await interaction.reply({ content: `❌ Lỗi: ${err.message}`, ephemeral: true })
    }
  },
}
