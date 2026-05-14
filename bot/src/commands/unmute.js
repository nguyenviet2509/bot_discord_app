const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Gỡ mute (timeout) cho thành viên')
    .addUserOption(opt => opt.setName('user').setDescription('Thành viên cần gỡ mute').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Lý do'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user')
    const reason = interaction.options.getString('reason') || 'Manual unmute'

    const target = await interaction.guild.members.fetch(user.id).catch(() => null)
    if (!target) {
      return interaction.reply({ content: '❌ Không tìm thấy thành viên này trong server.', ephemeral: true })
    }
    if (!target.isCommunicationDisabled()) {
      return interaction.reply({ content: 'ℹ️ Thành viên này không đang bị mute.', ephemeral: true })
    }

    try {
      await target.timeout(null, reason)
      await interaction.reply(`🔊 Đã gỡ mute **${user.tag}**.\n📝 Lý do: ${reason}`)
    } catch (err) {
      console.error('[unmute]', err)
      await interaction.reply({ content: `❌ Lỗi: ${err.message}`, ephemeral: true })
    }
  },
}
