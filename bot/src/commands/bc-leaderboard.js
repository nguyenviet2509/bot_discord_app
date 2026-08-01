// /bc-leaderboard: hien thi toan bo member co sao BlessCastle.
// Chia thanh nhieu embed neu vuot qua gioi han description (4096 chars).

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const bcDb = require('../../../shared/db-blesscastle')

const MEDALS = ['🥇', '🥈', '🥉']
const MAX_DESC_CHARS = 3800 // buffer duoi 4096 de an toan
const MAX_EMBEDS_PER_MSG = 10

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
    .setDescription('Toan bo member co sao BlessCastle (sort DESC)'),

  async execute(interaction) {
    const guildId = interaction.guild.id
    await interaction.deferReply()

    const rows = bcDb.listActiveStars(guildId)
    if (rows.length === 0) {
      return interaction.editReply({ content: 'Chua co ai co sao BlessCastle trong server nay.' })
    }

    // Build tat ca line
    const lines = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const mention = await resolveMention(interaction.guild, r.user_id)
      const rank = i < 3 ? MEDALS[i] : `**${i + 1}.**`
      lines.push(`${rank} ${mention} — **${r.stars}** ⭐`)
    }

    // Chia thanh cac chunk khong vuot MAX_DESC_CHARS
    const chunks = []
    let cur = []
    let curLen = 0
    for (const line of lines) {
      const addLen = line.length + 1
      if (curLen + addLen > MAX_DESC_CHARS && cur.length > 0) {
        chunks.push(cur); cur = []; curLen = 0
      }
      cur.push(line); curLen += addLen
    }
    if (cur.length > 0) chunks.push(cur)

    const embeds = chunks.slice(0, MAX_EMBEDS_PER_MSG).map((chunk, idx) => {
      const eb = new EmbedBuilder()
        .setColor(0xfbbf24)
        .setDescription(chunk.join('\n'))
      if (idx === 0) eb.setTitle('🏰 BlessCastle Leaderboard')
      if (idx === chunks.length - 1) {
        eb.setFooter({ text: `${rows.length} thanh vien co sao` }).setTimestamp()
      }
      return eb
    })

    return interaction.editReply({ embeds, allowedMentions: { parse: [] } })
  },
}
