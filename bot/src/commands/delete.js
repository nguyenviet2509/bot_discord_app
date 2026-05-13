const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Xóa một số lượng tin nhắn trong kênh (tối đa 100)')
    .addIntegerOption(opt =>
      opt
        .setName('amount')
        .setDescription('Số tin nhắn cần xóa (1–100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount')
    const channel = interaction.channel

    // Kiểm tra bot có quyền ManageMessages không
    const botMember = interaction.guild.members.me
    if (!channel.permissionsFor(botMember).has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: '❌ Bot không có quyền **Manage Messages** trong kênh này.',
        ephemeral: true,
      })
    }

    await interaction.deferReply({ ephemeral: true })

    try {
      // bulkDelete lọc bỏ tin nhắn cũ hơn 14 ngày (filterOld = true)
      const deleted = await channel.bulkDelete(amount, true)

      const actualCount = deleted.size
      const skipped = amount - actualCount

      let content = `🗑️ Đã xóa thành công **${actualCount}** tin nhắn.`
      if (skipped > 0) {
        content += `\n⚠️ Bỏ qua **${skipped}** tin nhắn (cũ hơn 14 ngày, Discord không cho xóa hàng loạt).`
      }

      await interaction.editReply({ content })
    } catch (err) {
      console.error('[delete] bulkDelete error:', err)
      await interaction.editReply({
        content: '❌ Có lỗi khi xóa tin nhắn. Hãy kiểm tra lại quyền của bot.',
      })
    }
  },
}
