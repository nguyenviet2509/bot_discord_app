// Slash command /post-image: tao bai dang co kem anh (anh required)
// Khac /post o cho anh bat buoc, member chu dong chon command nay khi muon co anh
const { SlashCommandBuilder } = require('discord.js')
const db = require('../../../shared/db')
const { setPending } = require('../utils/pending-image-cache')
const { buildCreateModal } = require('./post')

const MAX_IMAGE_BYTES = 1_048_576 // 1 MB

module.exports = {
  data: new SlashCommandBuilder()
    .setName('post-image')
    .setDescription('Gửi bài đăng có kèm ảnh (ảnh tối đa 1MB)')
    .addAttachmentOption(o =>
      o.setName('image').setDescription('Ảnh đính kèm (tối đa 1MB)').setRequired(true)
    ),

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

    const image = interaction.options.getAttachment('image')
    if (!image.contentType?.startsWith('image/')) {
      return interaction.reply({ content: '🚫 File đính kèm không phải ảnh.', ephemeral: true })
    }
    if (image.size > MAX_IMAGE_BYTES) {
      const mb = (image.size / 1024 / 1024).toFixed(2)
      return interaction.reply({ content: `🚫 Ảnh vượt quá 1MB (${mb}MB). Vui lòng nén nhỏ hơn.`, ephemeral: true })
    }

    setPending(`${interaction.user.id}:create`, image.url)
    await interaction.showModal(buildCreateModal())
  },
}
