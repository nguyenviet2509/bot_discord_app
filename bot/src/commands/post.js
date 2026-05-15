// Slash command /post: tao bai dang text-only (khong anh)
// Member muon dinh kem anh -> dung /post-image
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js')
const db = require('../../../shared/db')

function buildCreateModal(customId = 'post:create-modal') {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle('Tạo bài đăng mới')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('title').setLabel('Tiêu đề').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('content').setLabel('Nội dung').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('price').setLabel('Giá (tuỳ chọn)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('contact').setLabel('Liên hệ (tuỳ chọn)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200)
      ),
    )
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('post')
    .setDescription('Gửi bài đăng mới (chỉ chữ). Có ảnh? Dùng /post-image'),

  buildCreateModal,

  async execute(interaction) {
    const settings = db.getSettings(interaction.guild.id)
    if (!settings?.post_entry_channel_id) {
      return interaction.reply({ content: '🚫 Admin chưa cấu hình kênh đăng bài.', ephemeral: true })
    }
    if (interaction.channel.id !== settings.post_entry_channel_id) {
      return interaction.reply({
        content: `🚫 Vui lòng dùng lệnh này trong <#${settings.post_entry_channel_id}>.`,
        ephemeral: true,
      })
    }
    await interaction.showModal(buildCreateModal())
  },
}
