const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick một thành viên khỏi server')
    .addUserOption(opt => opt.setName('user').setDescription('Thành viên cần kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Lý do (tuỳ chọn)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user')
    const reason = interaction.options.getString('reason') || 'Không có lý do'

    const target = await interaction.guild.members.fetch(user.id).catch(() => null)
    if (!target) {
      return interaction.reply({ content: '❌ Không tìm thấy thành viên này trong server.', ephemeral: true })
    }
    if (!target.kickable) {
      return interaction.reply({ content: '❌ Không thể kick thành viên này (role cao hơn bot hoặc thiếu quyền).', ephemeral: true })
    }

    try {
      await target.kick(reason)
      await interaction.reply(`👢 Đã kick **${user.tag}**.\n📝 Lý do: ${reason}`)
    } catch (err) {
      console.error('[kick]', err)
      await interaction.reply({ content: `❌ Lỗi: ${err.message}`, ephemeral: true })
    }
  },
}
