const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const voiceStatsDb = require('../../../shared/db-voice-stats')
const { formatDuration, getRangeBounds } = require('../utils/voice-stats-format')

const RANGE_CHOICES = [
  { name: 'Hom nay', value: 'today' },
  { name: '7 ngay qua', value: '7d' },
  { name: '30 ngay qua', value: '30d' },
  { name: 'Tat ca thoi gian', value: 'all' },
]

const MEDALS = ['🥇', '🥈', '🥉']

async function resolveDisplay(guild, userId) {
  try {
    const m = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null)
    if (m) return { mention: `<@${userId}>`, name: m.displayName || m.user.username }
  } catch (_) {}
  return { mention: `<@${userId}>`, name: `Unknown (${userId})` }
}

function resolveChannelName(guild, channelId) {
  const c = guild.channels.cache.get(channelId)
  return c ? c.name : `#${channelId}`
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voicestats')
    .setDescription('Thong ke thoi gian voice (leaderboard hoac ca nhan)')
    .addSubcommand(sub =>
      sub
        .setName('top')
        .setDescription('Bang xep hang user voice nhieu nhat')
        .addStringOption(opt =>
          opt.setName('range').setDescription('Khoang thoi gian').setRequired(false).addChoices(...RANGE_CHOICES)
        )
        .addIntegerOption(opt =>
          opt.setName('limit').setDescription('So luong top hien thi (5-25)').setRequired(false).setMinValue(5).setMaxValue(25)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('me')
        .setDescription('Thong ke voice cua ban hoac user khac')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Thanh vien can xem (mac dinh la ban)').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('range').setDescription('Khoang thoi gian').setRequired(false).addChoices(...RANGE_CHOICES)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (!voiceStatsDb.isVoiceStatsEnabled(guildId)) {
      return interaction.reply({ content: 'Tinh nang thong ke voice dang **tat** trong server nay.', ephemeral: true })
    }

    const rangeKey = interaction.options.getString('range') || (sub === 'top' ? '7d' : '7d')
    const { from, to, label } = getRangeBounds(rangeKey)

    if (sub === 'top') {
      const limit = interaction.options.getInteger('limit') || 10
      await interaction.deferReply()
      const rows = voiceStatsDb.getLeaderboard(guildId, from, to, limit)
      if (rows.length === 0) {
        return interaction.editReply({ content: `Chua co du lieu thong ke voice trong **${label}**.` })
      }
      const lines = []
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const { mention } = await resolveDisplay(interaction.guild, r.user_id)
        const rank = i < 3 ? MEDALS[i] : `**${i + 1}.**`
        lines.push(`${rank} ${mention} — **${formatDuration(r.total_sec)}** (${r.join_count} lan)`)
      }
      const embed = new EmbedBuilder()
        .setColor(0x6366f1)
        .setTitle(`🎙️ Top Voice — ${label}`)
        .setDescription(lines.join('\n'))
        .setTimestamp()
      return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } })
    }

    // /voicestats me (ephemeral)
    const target = interaction.options.getUser('user') || interaction.user
    await interaction.deferReply({ ephemeral: true })

    const stats = voiceStatsDb.getUserStats(guildId, target.id, from, to)
    if (!stats) {
      return interaction.editReply({ content: `**${target.username}** chua co du lieu voice trong **${label}**.` })
    }
    const topCh = voiceStatsDb.getTopChannelForUser(guildId, target.id, from, to)
    const topChName = topCh ? resolveChannelName(interaction.guild, topCh.channel_id) : '—'
    const topChDur = topCh ? formatDuration(topCh.total_sec) : '—'

    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setAuthor({ name: target.username, iconURL: target.displayAvatarURL({ dynamic: true }) })
      .setTitle(`🎙️ Voice Stats — ${label}`)
      .addFields(
        { name: 'Tong thoi gian', value: `**${formatDuration(stats.total_sec)}**`, inline: true },
        { name: 'So lan join', value: `**${stats.join_count}**`, inline: true },
        { name: 'Xep hang', value: `**#${stats.rank}** / ${stats.total_members}`, inline: true },
        { name: 'Channel ua thich', value: `**#${topChName}** (${topChDur})`, inline: false },
      )
      .setTimestamp()
    return interaction.editReply({ embeds: [embed] })
  },
}
