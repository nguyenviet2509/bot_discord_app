// Slash command /rps @user [stake] - tao tran PvP, gui pick UI cho A,
// post embed thach dau public cho B accept.

const { SlashCommandBuilder } = require('discord.js')
const { getCoin } = require('../../../../../shared/db-mini-game')
const matchStore = require('../services/pvp-match-store')
const timeoutMgr = require('../services/match-timeout')
const renderer = require('../services/rps-renderer')
const lifecycle = require('../services/rps-lifecycle')

const STAKE_MIN = 1
const STAKE_MAX = 1000
const ACCEPT_TIMEOUT_MS = 60_000

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Kéo Búa Bao PvP — thách đấu một thành viên khác, cược coin')
    .addUserOption(o => o.setName('doi-thu').setDescription('Người bạn muốn thách đấu').setRequired(true))
    .addIntegerOption(o => o.setName('cuoc').setDescription(`Số coin cược (mặc định 10, tối đa ${STAKE_MAX})`).setMinValue(STAKE_MIN).setMaxValue(STAKE_MAX)),

  async execute(interaction) {
    const guild = interaction.guild
    if (!guild) return interaction.reply({ content: 'Lệnh chỉ dùng trong server.', ephemeral: true })

    const opponent = interaction.options.getUser('doi-thu')
    const stake = interaction.options.getInteger('cuoc') ?? 10
    const a = interaction.user

    // ===== Validation =====
    if (opponent.id === a.id) return interaction.reply({ content: '🙅 Không thể tự thách đấu chính mình.', ephemeral: true })
    if (opponent.bot) return interaction.reply({ content: '🤖 Bot không tham gia PvP được.', ephemeral: true })

    // Member B con trong guild?
    const memberB = await guild.members.fetch(opponent.id).catch(() => null)
    if (!memberB) return interaction.reply({ content: '❌ Người bạn chọn không còn trong server.', ephemeral: true })

    if (stake < STAKE_MIN || stake > STAKE_MAX) {
      return interaction.reply({ content: `❌ Cược phải trong khoảng ${STAKE_MIN}-${STAKE_MAX} coin.`, ephemeral: true })
    }

    // Active match check (chong spam)
    const activeA = matchStore.getActiveMatchByUser(guild.id, a.id)
    if (activeA) return interaction.reply({ content: `⚠️ Bạn đang có 1 trận chưa kết thúc (#${activeA.id}).`, ephemeral: true })
    const activeB = matchStore.getActiveMatchByUser(guild.id, opponent.id)
    if (activeB) return interaction.reply({ content: `⚠️ ${opponent.username} đang có 1 trận chưa kết thúc.`, ephemeral: true })

    // Coin check
    const balA = getCoin(guild.id, a.id)
    if (balA < stake) return interaction.reply({ content: `💸 Bạn chỉ có 🪙 ${balA}, không đủ cược ${stake} coin.`, ephemeral: true })
    const balB = getCoin(guild.id, opponent.id)
    if (balB < stake) return interaction.reply({ content: `💸 ${opponent.username} chỉ có 🪙 ${balB}, không đủ cược ${stake} coin.`, ephemeral: true })

    // ===== Create match (escrow A) =====
    const match = matchStore.createMatch({
      guildId: guild.id, channelId: interaction.channelId,
      game: 'rps', playerA: a.id, playerB: opponent.id, stake,
    })

    const aTag = (await guild.members.fetch(a.id).catch(() => null))?.displayName || a.username
    const bTag = memberB.displayName

    // ===== Reply ephemeral pick UI cho A =====
    await interaction.reply({
      content: `🎮 Đã gửi lời thách đấu tới **${bTag}**. Bạn chọn nước đi sẵn (B accept xong sẽ reveal):`,
      components: [renderer.buildPickButtons(match.id)],
      ephemeral: true,
    })

    // ===== Post public challenge embed =====
    const publicMsg = await interaction.channel.send({
      content: `${opponent}`, // ping B
      embeds: [renderer.buildChallengeEmbed({ aTag, bTag, stake, matchId: match.id })],
      components: [renderer.buildChallengeButtons(match.id)],
    })
    matchStore.setMessageId(match.id, publicMsg.id)

    // ===== Timeout 60s: B chua accept -> huy =====
    timeoutMgr.set(match.id, ACCEPT_TIMEOUT_MS, async () => {
      const m = matchStore.getMatchById(match.id)
      if (!m || m.state !== matchStore.STATE.PENDING) return
      await lifecycle.cancelByTimeout(interaction.client, match.id, 'B không phản hồi sau 60s')
    })
  },
}
