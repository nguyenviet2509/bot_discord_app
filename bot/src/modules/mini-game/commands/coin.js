// /coin balance | /coin history - xem so du va lich su giao dich coin trong guild.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const { getCoin, getCoinHistory } = require('../../../../../shared/db-mini-game')

function formatDelta(d) { return (d >= 0 ? '+' : '') + d }
function formatTime(unix) {
  const d = new Date(unix * 1000)
  return `<t:${unix}:R>` // Discord timestamp tu render
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coin')
    .setDescription('Xem số dư và lịch sử coin của bạn')
    .addSubcommand(s => s.setName('balance').setDescription('Xem số dư hiện tại'))
    .addSubcommand(s => s.setName('history').setDescription('Xem 10 giao dịch gần nhất')),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: 'Lệnh chỉ dùng trong server.', ephemeral: true })
    const sub = interaction.options.getSubcommand()
    const guildId = interaction.guild.id
    const userId = interaction.user.id

    if (sub === 'balance') {
      const bal = getCoin(guildId, userId)
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x6366f1).setTitle('💰 Ví coin của bạn').setDescription(`Số dư: **🪙 ${bal}**`)],
        ephemeral: true,
      })
    }

    if (sub === 'history') {
      const rows = getCoinHistory(guildId, userId, 10)
      if (!rows.length) return interaction.reply({ content: '📭 Chưa có giao dịch nào.', ephemeral: true })
      const lines = rows.map(r => {
        const delta = formatDelta(r.delta)
        const sign = r.delta >= 0 ? '🟢' : '🔴'
        return `${sign} **${delta}** coin · ${r.reason || '—'} · ${formatTime(r.created_at)}`
      })
      const bal = getCoin(guildId, userId)
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x6366f1)
          .setTitle('📜 Lịch sử coin (10 gần nhất)')
          .setDescription(lines.join('\n'))
          .setFooter({ text: `Số dư hiện tại: 🪙 ${bal}` })],
        ephemeral: true,
      })
    }
  },
}
