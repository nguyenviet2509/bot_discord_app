// Lifecycle handlers cho /rps PvP: accept, decline, pick, settle, cancel-by-timeout.
// Goi tu button-handler (co interaction) hoac tu timeout (chi co client).

const matchStore = require('./pvp-match-store')
const timeoutMgr = require('./match-timeout')
const renderer = require('./rps-renderer')
const engine = require('./rps-engine')
const { getCoin } = require('../../../../../shared/db-mini-game')

const PICK_TIMEOUT_MS = 60_000

async function fetchPublicMsg(client, m) {
  if (!m?.message_id) return null
  const ch = client.channels.cache.get(m.channel_id) || await client.channels.fetch(m.channel_id).catch(() => null)
  if (!ch) return null
  return ch.messages.fetch(m.message_id).catch(() => null)
}

async function getTags(client, m) {
  const guild = client.guilds.cache.get(m.guild_id) || await client.guilds.fetch(m.guild_id).catch(() => null)
  if (!guild) return { aTag: m.player_a, bTag: m.player_b, guild: null }
  return { aTag: await renderer.userTag(guild, m.player_a), bTag: await renderer.userTag(guild, m.player_b), guild }
}

// B bam Accept.
async function onAccept(interaction, matchId) {
  const m = matchStore.getMatchById(matchId)
  if (!m) return interaction.reply({ content: '❌ Trận không tồn tại.', ephemeral: true })
  if (interaction.user.id !== m.player_b) return interaction.reply({ content: '❌ Bạn không phải đối thủ trong trận này.', ephemeral: true })
  if (m.state !== matchStore.STATE.PENDING) return interaction.reply({ content: '⚠️ Trận đã được xử lý.', ephemeral: true })

  // Re-check coin (co the da tieu het giua chung)
  const balB = getCoin(m.guild_id, m.player_b)
  if (balB < m.stake) {
    return interaction.reply({ content: `💸 Bạn chỉ có 🪙 ${balB}, không đủ cược ${m.stake} coin.`, ephemeral: true })
  }

  matchStore.acceptMatch(matchId)
  timeoutMgr.clear(matchId)

  const { aTag, bTag } = await getTags(interaction.client, m)
  const fresh = matchStore.getMatchById(matchId)

  // Edit message public: chuyen sang trang thai picking + public open-pick button
  await interaction.update({
    embeds: [renderer.buildPickingEmbed({ aTag, bTag, stake: m.stake, matchId, pickA: fresh.pick_a, pickB: fresh.pick_b })],
    components: [renderer.buildOpenPickButton(matchId)],
    content: `<@${m.player_a}> <@${m.player_b}> bấm **🎯 Chọn nước đi** để chọn (riêng tư, chỉ bạn thấy).`,
  })

  // Timeout 60s: chua pick du -> settle theo nguoi da pick
  timeoutMgr.set(matchId, PICK_TIMEOUT_MS, async () => {
    const cur = matchStore.getMatchById(matchId)
    if (!cur || cur.state !== matchStore.STATE.PICKING) return
    await onPickTimeout(interaction.client, matchId)
  })
}

// B bam Decline.
async function onDecline(interaction, matchId) {
  const m = matchStore.getMatchById(matchId)
  if (!m) return interaction.reply({ content: '❌ Trận không tồn tại.', ephemeral: true })
  if (interaction.user.id !== m.player_b) return interaction.reply({ content: '❌ Bạn không phải đối thủ trong trận này.', ephemeral: true })
  if (m.state !== matchStore.STATE.PENDING) return interaction.reply({ content: '⚠️ Trận đã được xử lý.', ephemeral: true })

  matchStore.cancelMatch(matchId, 'declined')
  timeoutMgr.clear(matchId)

  const { aTag, bTag } = await getTags(interaction.client, m)
  await interaction.update({
    embeds: [renderer.buildCancelEmbed({ aTag, bTag, matchId, reason: `${bTag} đã từ chối` })],
    components: [], content: '',
  })
}

// User (A hoac B) bam public "Chon nuoc di" -> bot reply ephemeral pick buttons.
async function onOpenPick(interaction, matchId) {
  const m = matchStore.getMatchById(matchId)
  if (!m) return interaction.reply({ content: '❌ Trận không tồn tại.', ephemeral: true })
  const isA = interaction.user.id === m.player_a
  const isB = interaction.user.id === m.player_b
  if (!isA && !isB) return interaction.reply({ content: '❌ Bạn không phải người chơi trong trận này.', ephemeral: true })
  if (m.state !== matchStore.STATE.PICKING) {
    return interaction.reply({ content: '⚠️ Trận chưa sẵn sàng hoặc đã kết thúc.', ephemeral: true })
  }
  const myPick = isA ? m.pick_a : m.pick_b
  if (myPick) {
    const label = require('./rps-engine').LABEL[myPick]
    return interaction.reply({ content: `✅ Bạn đã chọn ${label.emoji} **${label.vi}**. Chờ đối thủ...`, ephemeral: true })
  }
  return interaction.reply({
    content: '🎮 Chọn nước đi của bạn:',
    components: [renderer.buildPickButtons(matchId)],
    ephemeral: true,
  })
}

// 1 trong 2 player bam nut pick.
async function onPick(interaction, matchId, pick) {
  const m = matchStore.getMatchById(matchId)
  if (!m) return interaction.reply({ content: '❌ Trận không tồn tại.', ephemeral: true })
  const isA = interaction.user.id === m.player_a
  const isB = interaction.user.id === m.player_b
  if (!isA && !isB) return interaction.reply({ content: '❌ Không phải lượt của bạn.', ephemeral: true })
  // A duoc pick som (khi state=pending) HOAC sau accept (state=picking)
  if (isA && m.state !== matchStore.STATE.PENDING && m.state !== matchStore.STATE.PICKING) {
    return interaction.reply({ content: '⚠️ Trận đã kết thúc.', ephemeral: true })
  }
  if (isB && m.state !== matchStore.STATE.PICKING) {
    return interaction.reply({ content: '⚠️ Cần chấp nhận trận đấu trước.', ephemeral: true })
  }
  if ((isA && m.pick_a) || (isB && m.pick_b)) {
    return interaction.reply({ content: '⚠️ Bạn đã chọn rồi.', ephemeral: true })
  }

  matchStore.recordPick(matchId, interaction.user.id, pick)
  const fresh = matchStore.getMatchById(matchId)
  const label = engine.LABEL[pick]
  await interaction.update({
    content: `✅ Bạn chọn ${label.emoji} **${label.vi}**. Chờ đối thủ...`,
    components: [],
  }).catch(() => {})

  // Update public embed neu da accept
  if (fresh.state === matchStore.STATE.PICKING) {
    const { aTag, bTag } = await getTags(interaction.client, fresh)
    const msg = await fetchPublicMsg(interaction.client, fresh)
    if (msg) {
      await msg.edit({
        embeds: [renderer.buildPickingEmbed({ aTag, bTag, stake: fresh.stake, matchId, pickA: fresh.pick_a, pickB: fresh.pick_b })],
      }).catch(() => {})
    }
    // Du 2 pick -> settle
    if (fresh.pick_a && fresh.pick_b) {
      timeoutMgr.clear(matchId)
      await settle(interaction.client, matchId)
    }
  }
}

// Settle: judge va chuyen coin, edit public message.
async function settle(client, matchId) {
  const m = matchStore.getMatchById(matchId)
  if (!m || m.state !== matchStore.STATE.PICKING) return
  let winner
  if (m.pick_a && m.pick_b) {
    const r = engine.judge(m.pick_a, m.pick_b)
    winner = r === 'draw' ? 'draw' : (r === 'a' ? m.player_a : m.player_b)
  } else if (m.pick_a) {
    winner = m.player_a
  } else if (m.pick_b) {
    winner = m.player_b
  } else {
    // Khong ai pick -> hoa (hoan)
    winner = 'draw'
  }
  matchStore.settleMatch(matchId, winner)
  const final = matchStore.getMatchById(matchId)
  const { aTag, bTag } = await getTags(client, final)
  const balanceA = getCoin(final.guild_id, final.player_a)
  const balanceB = getCoin(final.guild_id, final.player_b)
  const winnerCode = winner === 'draw' ? 'draw' : (winner === final.player_a ? 'a' : 'b')
  const timeoutLoser = (!m.pick_a || !m.pick_b)
    ? (!m.pick_a ? 'a' : 'b')
    : null
  const msg = await fetchPublicMsg(client, final)
  if (msg) {
    await msg.edit({
      embeds: [renderer.buildResultEmbed({
        aTag, bTag, pickA: m.pick_a, pickB: m.pick_b,
        winner: winnerCode, stake: final.stake, matchId,
        balanceA, balanceB, timeoutLoser,
      })],
      components: [],
    }).catch(() => {})
  }
}

// Timeout het 60s ma chua du pick -> settle.
async function onPickTimeout(client, matchId) {
  await settle(client, matchId)
}

// Timeout B chua accept -> huy.
async function cancelByTimeout(client, matchId, reason) {
  const m = matchStore.getMatchById(matchId)
  if (!m || m.state !== matchStore.STATE.PENDING) return
  matchStore.cancelMatch(matchId, 'timeout')
  const { aTag, bTag } = await getTags(client, m)
  const msg = await fetchPublicMsg(client, m)
  if (msg) {
    await msg.edit({
      embeds: [renderer.buildCancelEmbed({ aTag, bTag, matchId, reason })],
      components: [], content: '',
    }).catch(() => {})
  }
}

module.exports = { onAccept, onDecline, onOpenPick, onPick, cancelByTimeout, settle }
