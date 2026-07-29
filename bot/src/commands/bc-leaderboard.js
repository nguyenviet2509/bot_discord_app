// /bc-leaderboard: top 10 member co nhieu sao BlessCastle nhat.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const bcDb = require('../../../shared/db-blesscastle')

const MEDALS = ['🥇', '🥈', '🥉']

async function resolveMention(guild, userId) {
  try {
    const m = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null)
    if (m) return `<@${userId}>`
  } catch (_) {}
  return `<@${userId}>`
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bc-leaderboard')
    .setDescription('Top 10 member nhieu sao BlessCastle nhat'),

  async execute(interaction) {
    const guildId = interaction.guild.id
    await interaction.deferReply()

    const rows = bcDb.listActiveStars(guildId).slice(0, 10)
    if (rows.length === 0) {
      return interaction.editReply({ content: 'Chua co ai co sao BlessCastle trong server nay.' })
    }

    const lines = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const mention = await resolveMention(interaction.guild, r.user_id)
      const rank = i < 3 ? MEDALS[i] : `**${i + 1}.**`
      lines.push(`${rank} ${mention} — **${r.stars}** ⭐`)
    }

    const embed = new EmbedBuilder()
      .setColor(0xfbbf24)
      .setTitle('🏰 BlessCastle Leaderboard')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${rows.length} thanh vien co sao` })
      .setTimestamp()

    return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } })
  },
}
