// Build cac embed + button row cho /rps PvP.
// Tach khoi command/handler de tai su dung & test rieng.

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const { LABEL, VALID } = require('./rps-engine')
const { getCoin } = require('../../../../../shared/db-mini-game')

const COLOR = { wait: 0x6366f1, win: 0x22c55e, lose: 0xef4444, draw: 0xeab308, cancel: 0x4e5058 }

// Embed loi thach dau (pending) - chua co ai chon.
function buildChallengeEmbed({ aTag, bTag, stake, matchId }) {
  const isCasual = !stake
  return new EmbedBuilder()
    .setColor(COLOR.draw)
    .setTitle('🥊 Thách đấu Kéo Búa Bao')
    .setDescription(`**${aTag}** thách đấu **${bTag}**`)
    .addFields(
      isCasual
        ? { name: '🎮 Chế độ', value: '**Vui** — không cược coin', inline: false }
        : { name: '💰 Cược', value: `**${stake} coin** / người · Thắng nhận **+${stake}**, thua **-${stake}**`, inline: false },
      { name: '⏱ Thời hạn', value: `${bTag} có 60s để chấp nhận`, inline: false },
    )
    .setFooter({ text: `Match #${matchId}${isCasual ? '' : ' • Coin đã được tạm giữ'}` })
}

// Row 2 nut accept/decline cho B.
function buildChallengeButtons(matchId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mg:rps:accept:${matchId}`).setLabel('Chấp nhận').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`mg:rps:decline:${matchId}`).setLabel('Từ chối').setEmoji('✖').setStyle(ButtonStyle.Danger),
  )
}

// Embed status sau khi B accept - cho ca 2 chon.
function buildPickingEmbed({ aTag, bTag, stake, matchId, pickA, pickB }) {
  const aIcon = pickA ? '✅ Đã chọn' : '⏳ Đang chọn...'
  const bIcon = pickB ? '✅ Đã chọn' : '⏳ Đang chọn...'
  const allPicked = pickA && pickB
  return new EmbedBuilder()
    .setColor(COLOR.wait)
    .setTitle('🎮 Kéo Búa Bao — PvP')
    .setDescription(allPicked ? '🎲 Đang lật bài...' : '⏳ Cả hai chọn nước đi...')
    .addFields(
      { name: aTag, value: aIcon, inline: true },
      { name: 'VS', value: '⚔️', inline: true },
      { name: bTag, value: bIcon, inline: true },
    )
    .setFooter({ text: `Match #${matchId} • ${stake ? `Cược ${stake} coin/người` : 'Vui (không cược)'} • Timeout 60s` })
}

// Row 3 nut pick gui ephemeral cho 1 player.
function buildPickButtons(matchId) {
  return new ActionRowBuilder().addComponents(
    ...VALID.map(pick => new ButtonBuilder()
      .setCustomId(`mg:rps:pick:${matchId}:${pick}`)
      .setLabel(LABEL[pick].vi)
      .setEmoji(LABEL[pick].emoji)
      .setStyle(ButtonStyle.Secondary)
    ),
  )
}

// Embed ket qua cuoi cung (reveal ca 2 + chuyen coin).
function buildResultEmbed({ aTag, bTag, pickA, pickB, winner, stake, matchId, balanceA, balanceB, timeoutLoser }) {
  let title, color, desc
  if (winner === 'draw') {
    title = '🤝 Hòa!'
    color = COLOR.draw
    desc = 'Cả hai chọn giống nhau, hoàn lại cọc.'
  } else {
    const winnerTag = winner === 'a' ? aTag : bTag
    title = `🏆 ${winnerTag} thắng!`
    color = COLOR.win
    desc = timeoutLoser ? `${timeoutLoser === 'a' ? aTag : bTag} không chọn kịp giờ.` : 'Một trận đấu kịch tính!'
  }
  const aLabel = pickA ? `${LABEL[pickA].emoji} ${LABEL[pickA].vi}` : '⏱ Hết giờ'
  const bLabel = pickB ? `${LABEL[pickB].emoji} ${LABEL[pickB].vi}` : '⏱ Hết giờ'
  const fields = [
    { name: aTag + (winner === 'a' ? ' 👑' : ''), value: aLabel, inline: true },
    { name: 'VS', value: '⚔️', inline: true },
    { name: bTag + (winner === 'b' ? ' 👑' : ''), value: bLabel, inline: true },
  ]
  if (stake > 0) {
    fields.push({ name: '💰 Kết toán', value: buildSettleText({ winner, stake, aTag, bTag, balanceA, balanceB }), inline: false })
  }
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc).addFields(...fields)
    .setFooter({ text: `Match #${matchId}${stake > 0 ? '' : ' • Vui (không cược)'}` })
}

function buildSettleText({ winner, stake, aTag, bTag, balanceA, balanceB }) {
  if (winner === 'draw') {
    return `Hoàn cọc: ${aTag} 🪙 ${balanceA} • ${bTag} 🪙 ${balanceB}`
  }
  const winA = winner === 'a'
  const dA = winA ? `+${stake}` : `-${stake}`
  const dB = winA ? `-${stake}` : `+${stake}`
  return `${aTag}: **${dA}** → 🪙 ${balanceA}\n${bTag}: **${dB}** → 🪙 ${balanceB}`
}

function buildCancelEmbed({ aTag, bTag, matchId, reason }) {
  return new EmbedBuilder()
    .setColor(COLOR.cancel)
    .setTitle('❌ Trận đấu bị hủy')
    .setDescription(`${aTag} vs ${bTag} — ${reason || 'không rõ lý do'}`)
    .setFooter({ text: `Match #${matchId} • Coin đã hoàn` })
}

// Lay tag hien thi cho user trong guild (member display name fallback to username).
async function userTag(guild, userId) {
  try {
    const m = await guild.members.fetch(userId)
    return m.displayName
  } catch {
    return `<@${userId}>`
  }
}

function balanceOf(guildId, userId) {
  return getCoin(guildId, userId)
}

module.exports = {
  buildChallengeEmbed,
  buildChallengeButtons,
  buildPickingEmbed,
  buildPickButtons,
  buildResultEmbed,
  buildCancelEmbed,
  userTag,
  balanceOf,
}
