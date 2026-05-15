// Slash command /post-delete: xoa bai (chu bai hoac admin co ManageMessages)
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const dbPosts = require('../../../shared/db-posts')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('post-delete')
    .setDescription('Xoá bài đăng của bạn')
    .addIntegerOption(o =>
      o.setName('post_id').setDescription('Bài cần xoá').setRequired(true).setAutocomplete(true)
    ),

  async execute(interaction) {
    const postId = interaction.options.getInteger('post_id')
    const post = dbPosts.getPost(postId)
    if (!post) return interaction.reply({ content: '❌ Bài không tồn tại.', ephemeral: true })

    const isOwner = post.author_id === interaction.user.id
    const isAdmin = interaction.member.permissions.has('ManageMessages')
    if (!isOwner && !isAdmin) {
      return interaction.reply({ content: '❌ Bạn không có quyền xoá bài này.', ephemeral: true })
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`post:delete-confirm:${postId}`).setLabel('Xoá').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`post:delete-cancel:${postId}`).setLabel('Huỷ').setStyle(ButtonStyle.Secondary),
    )
    await interaction.reply({
      content: `⚠️ Xác nhận xoá bài **#${postId}** "${post.title}"?\nThread + message review sẽ bị xoá vĩnh viễn.`,
      components: [row],
      ephemeral: true,
    })
  },
}
