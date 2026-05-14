const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db = require('../../../shared/db')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Gỡ ban một người dùng theo Discord ID')
    .addStringOption(opt => opt.setName('user_id').setDescription('Discord ID của user').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Lý do'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id').trim()
    const reason = interaction.options.getString('reason') || 'Manual unban'

    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({ content: '❌ Discord ID không hợp lệ.', ephemeral: true })
    }

    try {
      await interaction.guild.members.unban(userId, reason)
      db.removeTempBan(interaction.guild.id, userId)
      await interaction.reply(`✅ Đã gỡ ban user ID **${userId}**.\n📝 Lý do: ${reason}`)
    } catch (err) {
      console.error('[unban]', err)
      const msg = err.code === 10026 ? 'User này không trong danh sách ban.' : err.message
      await interaction.reply({ content: `❌ ${msg}`, ephemeral: true })
    }
  },
}
