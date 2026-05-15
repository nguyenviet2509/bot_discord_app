// Build embed + buttons cho post approval flow
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')

const COLOR = {
  pending: 0x5865f2,   // blurple
  approved: 0x248046,  // green
  rejected: 0xda373c,  // red
}

const BADGE = {
  pending: '⏳ Chờ duyệt',
  approved: '✅ Đã duyệt',
  rejected: '❌ Bị từ chối',
}

// Build embed cho 1 post o trang thai bat ky
function buildPostEmbed(post, state = 'pending') {
  const embed = new EmbedBuilder()
    .setColor(COLOR[state] || COLOR.pending)
    .setAuthor({
      name: post.author_tag || 'Unknown',
      iconURL: post.author_avatar || undefined,
    })
    .setTitle(post.title.slice(0, 256))
    .setDescription(post.content.slice(0, 4000))

  const fields = []
  if (post.price)   fields.push({ name: '💰 Giá', value: post.price.slice(0, 1024), inline: true })
  if (post.contact) fields.push({ name: '📞 Liên hệ', value: post.contact.slice(0, 1024), inline: true })
  if (fields.length) embed.addFields(fields)
  if (post.image_url) embed.setImage(post.image_url)

  let footer = `${BADGE[state]} · Post #${post.id}`
  if (state === 'approved' && post.approver_tag) footer += ` · Duyệt bởi ${post.approver_tag}`
  if (state === 'rejected' && post.reject_reason) footer += ` · ${post.reject_reason.slice(0, 200)}`
  embed.setFooter({ text: footer })
  embed.setTimestamp(new Date((post.reviewed_at || post.created_at) * 1000))

  return embed
}

// Build action row 2 button cho review message
function buildReviewButtons(postId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`post:approve:${postId}`)
      .setLabel('Duyệt')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`post:reject:${postId}`)
      .setLabel('Từ chối')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
  )
}

module.exports = { buildPostEmbed, buildReviewButtons }
