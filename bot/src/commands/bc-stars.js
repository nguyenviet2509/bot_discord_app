// /bc-stars [user]: xem so sao BlessCastle cua ban hoac user khac.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const bcDb = require('../../../shared/db-blesscastle')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bc-stars')
    .setDescription('Xem sao BlessCastle cua ban hoac user khac')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Thanh vien can xem (mac dinh la ban)').setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user
    const guildId = interaction.guild.id

    const cfg = bcDb.getConfig(guildId)
    const stars = bcDb.getStars(guildId, target.id)
    const weekKey = bcDb.currentWeekKey()
    const att = bcDb.getUserWeekAttendance(guildId, target.id, weekKey)

    const minSec = cfg.minMinutes * 60
    const voiceMin = Math.floor(att.voice_seconds / 60)
    const achievedThisWeek = !!att.attended_manual || att.voice_seconds >= minSec
    const remaining = Math.max(0, 3 - stars)

    let progressText
    if (att.attended_manual) {
      progressText = '✅ Da diem danh thu cong'
    } else if (achievedThisWeek) {
      progressText = `✅ Da dat (${voiceMin}/${cfg.minMinutes} phut voice)`
    } else {
      progressText = `${voiceMin}/${cfg.minMinutes} phut voice`
    }

    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setAuthor({
        name: target.username,
        iconURL: target.displayAvatarURL ? target.displayAvatarURL({ dynamic: true }) : undefined,
      })
      .setTitle('⭐ BlessCastle Stars')
      .addFields(
        { name: 'So sao tich luy', value: `**${stars}** ⭐`, inline: true },
        { name: 'Con thieu', value: remaining === 0 ? 'Du 3⭐ - co the doi qua!' : `**${remaining}** sao`, inline: true },
        { name: 'Tuan nay', value: progressText, inline: false },
      )
      .setFooter({ text: `Tuan ${weekKey}` })
      .setTimestamp()

    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } })
  },
}
