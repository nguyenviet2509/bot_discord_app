// Slash command /post-edit: sua bai dang text-only (giu nguyen anh cu)
// Doi anh -> /post-edit-image. Xoa anh -> dat remove_image:true o lenh nay
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js')
const dbPosts = require('../../../shared/db-posts')
const { setPending } = require('../utils/pending-image-cache')

function buildEditModal(post, customId = null) {
  return new ModalBuilder()
    .setCustomId(customId || `post:edit-modal:${post.id}`)
    .setTitle(`Sửa bài #${post.id}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('title').setLabel('Tiêu đề').setStyle(TextInputStyle.Short)
          .setRequired(true).setMaxLength(100).setValue(post.title)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('content').setLabel('Nội dung').setStyle(TextInputStyle.Paragraph)
          .setRequired(true).setMaxLength(2000).setValue(post.content)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('price').setLabel('Giá (tuỳ chọn)').setStyle(TextInputStyle.Short)
          .setRequired(false).setMaxLength(100).setValue(post.price || '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('contact').setLabel('Liên hệ (tuỳ chọn)').setStyle(TextInputStyle.Short)
          .setRequired(false).setMaxLength(200).setValue(post.contact || '')
      ),
    )
}

// Helper guard dung chung cho /post-edit + /post-edit-image
function checkEditAccess(interaction, post) {
  if (!post) return '❌ Bài không tồn tại.'
  if (post.author_id !== interaction.user.id) return '❌ Bạn không phải chủ bài này.'
  if (post.status === 'deleted' || post.status === 'rejected') {
    return `❌ Bài đang ở trạng thái ${post.status}, không thể sửa.`
  }
  return null
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('post-edit')
    .setDescription('Sửa bài đăng chỉ chữ. Đổi ảnh? Dùng /post-edit-image')
    .addIntegerOption(o =>
      o.setName('post_id').setDescription('Bài cần sửa').setRequired(true).setAutocomplete(true)
    )
    .addBooleanOption(o =>
      o.setName('remove_image').setDescription('Xoá ảnh hiện tại của bài').setRequired(false)
    ),

  buildEditModal,
  checkEditAccess,

  async execute(interaction) {
    const postId = interaction.options.getInteger('post_id')
    const post = dbPosts.getPost(postId)
    const err = checkEditAccess(interaction, post)
    if (err) return interaction.reply({ content: err, ephemeral: true })

    if (interaction.options.getBoolean('remove_image')) {
      setPending(`${interaction.user.id}:edit:${postId}`, '__REMOVE__')
    }
    await interaction.showModal(buildEditModal(post))
  },
}
