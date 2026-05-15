// Slash command /post-edit-image: sua bai dang voi anh moi (anh required)
const { SlashCommandBuilder } = require('discord.js')
const dbPosts = require('../../../shared/db-posts')
const { setPending } = require('../utils/pending-image-cache')
const { buildEditModal, checkEditAccess } = require('./post-edit')

const MAX_IMAGE_BYTES = 1_048_576

module.exports = {
  data: new SlashCommandBuilder()
    .setName('post-edit-image')
    .setDescription('Sửa bài đăng với ảnh mới')
    .addIntegerOption(o =>
      o.setName('post_id').setDescription('Bài cần sửa').setRequired(true).setAutocomplete(true)
    )
    .addAttachmentOption(o =>
      o.setName('image').setDescription('Ảnh mới (tối đa 1MB)').setRequired(true)
    ),

  async execute(interaction) {
    const postId = interaction.options.getInteger('post_id')
    const post = dbPosts.getPost(postId)
    const err = checkEditAccess(interaction, post)
    if (err) return interaction.reply({ content: err, ephemeral: true })

    const image = interaction.options.getAttachment('image')
    if (!image.contentType?.startsWith('image/')) {
      return interaction.reply({ content: '🚫 File đính kèm không phải ảnh.', ephemeral: true })
    }
    if (image.size > MAX_IMAGE_BYTES) {
      const mb = (image.size / 1024 / 1024).toFixed(2)
      return interaction.reply({ content: `🚫 Ảnh vượt quá 1MB (${mb}MB).`, ephemeral: true })
    }

    setPending(`${interaction.user.id}:edit:${postId}`, image.url)
    await interaction.showModal(buildEditModal(post))
  },
}
