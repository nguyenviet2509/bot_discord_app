const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { parseDuration, formatDuration } = require('../utils/parse-duration')
const logModAction = require('../utils/log-mod-action')

const MAX_TIMEOUT_MS = 28 * 86_400_000 // Discord giới hạn timeout tối đa 28 ngày

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute (timeout) thành viên trong khoảng thời gian')
    .addUserOption(opt => opt.setName('user').setDescription('Thành viên cần mute').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Thời gian (vd: 10m, 2h, 7d). Mặc định 10m').setRequired(false))
    .addStringOption(opt => opt.setName('reason').setDescription('Lý do'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user')
    const durationStr = interaction.options.getString('duration') || '10m'
    const reason = interaction.options.getString('reason') || 'Không có lý do'

    const durationMs = parseDuration(durationStr)
    if (!durationMs) {
      return interaction.reply({
        content: '❌ Định dạng thời gian sai. Dùng: `10m`, `2h`, `7d` (s/m/h/d).',
        ephemeral: true,
      })
    }
    if (durationMs > MAX_TIMEOUT_MS) {
      return interaction.reply({
        content: '❌ Discord chỉ cho phép timeout tối đa **28 ngày**. Nếu muốn lâu hơn, dùng /ban.',
        ephemeral: true,
      })
    }

    const target = await interaction.guild.members.fetch(user.id).catch(() => null)
    if (!target) {
      return interaction.reply({ content: '❌ Không tìm thấy thành viên này trong server.', ephemeral: true })
    }
    if (!target.moderatable) {
      return interaction.reply({ content: '❌ Không thể mute thành viên này (role cao hơn bot hoặc thiếu quyền).', ephemeral: true })
    }

    try {
      await target.timeout(durationMs, reason)
      const until = Math.floor((Date.now() + durationMs) / 1000)
      logModAction(interaction, {
        action_type: 'mute', user, reason,
        duration_ms: durationMs, expires_at: until,
      })
      await interaction.reply(
        `🔇 Đã mute **${user.tag}** trong **${formatDuration(durationMs)}**.\n📝 Lý do: ${reason}\n⏰ Hết hạn: <t:${until}:R>`
      )
    } catch (err) {
      console.error('[mute]', err)
      await interaction.reply({ content: `❌ Lỗi: ${err.message}`, ephemeral: true })
    }
  },
}
