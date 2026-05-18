// /vinhdanh-history — liet ke N lan vinh danh gan nhat (ca-nhan + team)
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const dbHonor = require('../../../shared/db-honor')

const data = new SlashCommandBuilder()
  .setName('vinhdanh-history')
  .setDescription('Xem lịch sử các lần vinh danh gần đây')
  .addIntegerOption(o => o.setName('limit')
    .setDescription('Số lượng (1-20, mặc định 10)')
    .setMinValue(1).setMaxValue(20))
  .addStringOption(o => o.setName('type')
    .setDescription('Lọc theo loại (mặc định: tất cả)')
    .addChoices(
      { name: 'Tất cả', value: 'all' },
      { name: '👤 Cá nhân', value: 'top3' },
      { name: '👥 Team', value: 'team' },
    ))

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function formatTop3(r) {
  return `🥇 <@${r.user1_id}>  🥈 <@${r.user2_id}>  🥉 <@${r.user3_id}>`
}

function formatTeam(r) {
  const ids = Array.isArray(r.member_ids) ? r.member_ids : []
  const head = ids.slice(0, 3).map(id => `<@${id}>`).join(' ')
  const more = ids.length > 3 ? ` +${ids.length - 3}` : ''
  return `🎖️ **${r.team_name}** · ${head}${more} · ${ids.length} thành viên`
}

async function execute(interaction) {
  if (!interaction.guild) {
    return interaction.reply({ content: '❌ Lệnh này chỉ dùng trong server.', ephemeral: true })
  }

  const limit = interaction.options.getInteger('limit') || 10
  const typeFilter = interaction.options.getString('type') || 'all'

  let records
  if (typeFilter === 'top3') {
    records = dbHonor.listHonorHistory(interaction.guild.id, limit).map(r => ({ ...r, type: 'top3' }))
  } else if (typeFilter === 'team') {
    records = dbHonor.listHonorTeamHistory(interaction.guild.id, limit).map(r => ({ ...r, type: 'team' }))
  } else {
    records = dbHonor.listHonorAllHistory(interaction.guild.id, limit)
  }

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
    const icon = r.type === 'team' ? '👥' : '👤'
    const body = r.type === 'team' ? formatTeam(r) : formatTop3(r)
    return [
      `**${idx + 1}.** ${icon} 📅 ${date} — *${r.title}*`,
      body,
      `👤 bởi <@${r.created_by}>${viewLink}`,
    ].join('\n')
  })

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle(`🏛️ Lịch sử Vinh Danh — ${interaction.guild.name}`)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: `${records.length} bản ghi gần nhất${typeFilter !== 'all' ? ` · lọc: ${typeFilter}` : ''}` })
    .setTimestamp()

  return interaction.reply({ embeds: [embed], ephemeral: true })
}

module.exports = { data, execute }
