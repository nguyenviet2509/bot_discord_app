const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')

const MAX_AMOUNT = 1000
const BATCH_SIZE = 100

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Xóa một số lượng tin nhắn trong kênh (tối đa 1000)')
    .addIntegerOption(opt =>
      opt
        .setName('amount')
        .setDescription('Số tin nhắn cần xóa (1–1000)')
        .setMinValue(1)
        .setMaxValue(MAX_AMOUNT)
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
      let remaining = amount
      let totalDeleted = 0
      let stoppedEarly = false

      // Discord bulkDelete chỉ cho tối đa 100 tin/lần và bỏ qua tin > 14 ngày.
      // Lặp theo batch để xóa lên tới 1000 tin.
      while (remaining > 0) {
        const batch = Math.min(BATCH_SIZE, remaining)
        const deleted = await channel.bulkDelete(batch, true)
        const count = deleted.size
        totalDeleted += count
        remaining -= batch

        // Nếu batch trả về ít hơn yêu cầu -> hết tin có thể xóa (kênh hết tin hoặc tin quá cũ)
        if (count < batch) {
          stoppedEarly = true
          break
        }
      }

      const skipped = amount - totalDeleted
      let content = `🗑️ Đã xóa thành công **${totalDeleted}** tin nhắn.`
      if (skipped > 0) {
        content += `\n⚠️ Bỏ qua **${skipped}** tin nhắn (cũ hơn 14 ngày hoặc kênh hết tin nhắn để xóa).`
      }
      if (stoppedEarly && totalDeleted < amount) {
        // chỉ là note thêm, không lỗi
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
