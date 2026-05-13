const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const db = require('../../../shared/db')
const { levelFromXp, getXpProgress, buildProgressBar, getTierForLevel } = require('../services/level-service')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Xem rank và XP của bạn hoặc một thành viên khác')
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('Thành viên cần xem (mặc định là bạn)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply()

    const target = interaction.options.getUser('user') || interaction.user
    const guildId = interaction.guild.id
    const user = db.getUser(target.id, guildId)

    if (!user || user.xp === 0) {
      return interaction.editReply({
        content: `**${target.username}** chưa có điểm XP nào. Hãy chat nhiều hơn! 💬`,
      })
    }

    const level = user.level
    const { progress, needed, percent } = getXpProgress(user.xp, level)
    const bar = buildProgressBar(percent)
    const rank = db.getUserRank(target.id, guildId)
    const tier = getTierForLevel(level)

    const embed = new EmbedBuilder()
      .setColor(tier.color)
      .setAuthor({ name: target.username, iconURL: target.displayAvatarURL({ dynamic: true }) })
      .setTitle(`📊 Rank — ${target.username}`)
      .addFields(
        { name: 'Level', value: `**${level}**`, inline: true },
        { name: 'Danh hiệu', value: `${tier.badge} **${tier.name}**`, inline: true },
        { name: 'Hạng', value: `**#${rank}**`, inline: true },
        { name: 'Tổng XP', value: `**${user.xp.toLocaleString()}** XP`, inline: true },
        {
          name: `Tiến độ → Level ${level + 1}`,
          value: `\`[${bar}]\` ${percent}%\n${progress.toLocaleString()} / ${needed.toLocaleString()} XP`,
          inline: false,
        },
      )
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  },
}
