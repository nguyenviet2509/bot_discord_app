// /vinhdanh-history — liet ke N lan vinh danh gan nhat
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const dbHonor = require('../../../shared/db-honor')

const data = new SlashCommandBuilder()
  .setName('vinhdanh-history')
  .setDescription('Xem lịch sử các lần vinh danh gần đây')
  .addIntegerOption(o => o.setName('limit')
    .setDescription('Số lượng (1-20, mặc định 10)')
    .setMinValue(1).setMaxValue(20))

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

async function execute(interaction) {
  if (!interaction.guild) {
    return interaction.reply({ content: '❌ Lệnh này chỉ dùng trong server.', ephemeral: true })
  }

  const limit = interaction.options.getInteger('limit') || 10
  const records = dbHonor.listHonorHistory(interaction.guild.id, limit)

  if (!records.length) {
    return interaction.reply({
      content: '📭 Chưa có lần vinh danh nào trong server này.',
      ephemeral: true,
    })
  }

  const lines = records.map((r, idx) => {
    const date = formatDate(r.created_at)
    const link = r.message_id
      ? `https://discord.com/channels/${r.guild_id}/${r.channel_id}/${r.message_id}`
      : null
    const viewLink = link ? ` · [Xem](${link})` : ''
    return [
      `**${idx + 1}.** 📅 ${date} — *${r.title}*`,
      `🥇 <@${r.user1_id}>  🥈 <@${r.user2_id}>  🥉 <@${r.user3_id}>`,
      `👤 bởi <@${r.created_by}>${viewLink}`,
    ].join('\n')
  })

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle(`🏛️ Lịch sử Vinh Danh — ${interaction.guild.name}`)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: `${records.length} bản ghi gần nhất` })
    .setTimestamp()

  return interaction.reply({ embeds: [embed], ephemeral: true })
}

module.exports = { data, execute }
