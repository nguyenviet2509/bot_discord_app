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
    .addBooleanOption(opt =>
      opt
        .setName('force_old')
        .setDescription('Xóa cả tin nhắn cũ hơn 14 ngày (chậm, xóa từng tin một)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount')
    const forceOld = interaction.options.getBoolean('force_old') ?? false
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
      let oldDeleted = 0
      let channelEmpty = false
      let lastId

      const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000
      const now = Date.now()

      // Discord bulkDelete chỉ cho tối đa 100 tin/lần và không xóa được tin > 14 ngày.
      // Lặp theo batch để xóa lên tới 1000 tin.
      while (remaining > 0) {
        const fetchSize = Math.min(BATCH_SIZE, remaining)
        const fetched = await channel.messages.fetch({
          limit: fetchSize,
          ...(lastId ? { before: lastId } : {}),
        })

        if (fetched.size === 0) {
          channelEmpty = true
          break
        }

        lastId = fetched.last().id

        const recent = fetched.filter(m => now - m.createdTimestamp < FOURTEEN_DAYS_MS)
        const old = fetched.filter(m => now - m.createdTimestamp >= FOURTEEN_DAYS_MS)

        if (recent.size > 0) {
          const deleted = await channel.bulkDelete(recent, true)
          totalDeleted += deleted.size
        }

        if (forceOld && old.size > 0) {
          for (const msg of old.values()) {
            try {
              await msg.delete()
              oldDeleted += 1
              totalDeleted += 1
            } catch (e) {
              console.error('[delete] single delete error:', e?.message)
            }
          }
        }

        remaining -= fetched.size
      }

      const skipped = amount - totalDeleted
      let content = `🗑️ Đã xóa thành công **${totalDeleted}** tin nhắn.`
      if (forceOld && oldDeleted > 0) {
        content += `\n🐢 Trong đó có **${oldDeleted}** tin cũ >14 ngày (xóa từng tin).`
      }
      if (skipped > 0) {
        if (channelEmpty) {
          content += `\n⚠️ Bỏ qua **${skipped}** tin (kênh hết tin nhắn để xóa).`
        } else if (!forceOld) {
          content += `\n⚠️ Bỏ qua **${skipped}** tin cũ hơn 14 ngày. Dùng \`force_old: true\` để xóa cả tin cũ (chậm hơn).`
        } else {
          content += `\n⚠️ Bỏ qua **${skipped}** tin (lỗi khi xóa hoặc hết tin).`
        }
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
