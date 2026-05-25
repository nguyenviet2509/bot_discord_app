// Slash command /roll-control: host re-open ephemeral kem Start/Cancel buttons.
// Dung khi host reload Discord va mat ephemeral cu tu /roll-start.

const { SlashCommandBuilder, PermissionsBitField } = require('discord.js')
const store = require('../services/roll-session-store')
const renderer = require('../services/roll-renderer')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll-control')
    .setDescription('Mở lại bảng điều khiển ROLL session (chỉ host)')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return interaction.reply({ content: 'Lệnh chỉ dùng trong server.', ephemeral: true })

    const session = store.getActiveSessionByGuild(guild.id)
    if (!session) {
      return interaction.reply({
        content: '⚠️ Không có session ROLL nào đang active trong guild này.',
        ephemeral: true,
      })
    }

    // Strict host-only (khong cho admin override theo decision validation)
    if (interaction.user.id !== session.host_id) {
      return interaction.reply({
        content: `🚫 Chỉ host của session #${session.id} mới mở được bảng điều khiển.`,
        ephemeral: true,
      })
    }

    if (session.state !== 'open') {
      return interaction.reply({
        content: `⚠️ Session đang ở state '${session.state}', không cần điều khiển.`,
        ephemeral: true,
      })
    }

    return interaction.reply({
      content: `🎲 **Bảng điều khiển ROLL Session #${session.id}** (chỉ bạn thấy)\nHết hạn <t:${session.expires_at}:R>`,
      components: [renderer.buildHostButtons(session.id)],
      ephemeral: true,
    })
  },
}
