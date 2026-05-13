const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const db = require('../../../shared/db')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Xem bảng xếp hạng XP top 10 server'),

  async execute(interaction) {
    await interaction.deferReply()

    const guildId = interaction.guild.id
    const topUsers = db.getLeaderboard(guildId, 10)

    if (!topUsers.length) {
      return interaction.editReply({ content: 'Chưa có ai có điểm XP trong server này. 🦗' })
    }

    const medals = ['🥇', '🥈', '🥉']
    const lines = []

    for (let i = 0; i < topUsers.length; i++) {
      const u = topUsers[i]
      let username
      try {
        const discordUser = await interaction.client.users.fetch(u.id)
        username = discordUser.username
      } catch {
        username = `(ẩn danh)`
      }

      const isYou = u.id === interaction.user.id ? ' ← **bạn**' : ''
      const prefix = medals[i] || `\`#${i + 1}\``
      lines.push(`${prefix} **${username}**${isYou} — Lv.**${u.level}** • ${u.xp.toLocaleString()} XP`)
    }

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('🏆 Bảng xếp hạng — Top 10')
      .setDescription(lines.join('\n'))
      .setTimestamp()
      .setFooter({ text: interaction.guild.name })

    await interaction.editReply({ embeds: [embed] })
  },
}
