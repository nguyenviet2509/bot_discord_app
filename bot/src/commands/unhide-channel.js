const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js')
const db = require('../../../shared/db')
const logModAction = require('../utils/log-mod-action')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unhide-channel')
    .setDescription('Hiện lại kênh đã bị ẩn đối với 1 thành viên')
    .addUserOption(opt => opt.setName('user').setDescription('Thành viên cần gỡ ẩn').setRequired(true))
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Kênh cần gỡ ẩn (mặc định = kênh hiện tại)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildForum, ChannelType.GuildStageVoice)
    )
    .addStringOption(opt => opt.setName('reason').setDescription('Lý do'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const user = interaction.options.getUser('user')
    const channel = interaction.options.getChannel('channel') || interaction.channel
    const reason = interaction.options.getString('reason') || 'Gỡ ẩn thủ công'

    try {
      const existing = channel.permissionOverwrites.cache.get(user.id)
      if (!existing) {
        return interaction.reply({
          content: `ℹ️ **${user.tag}** không có overwrite nào trên <#${channel.id}>.`,
          ephemeral: true,
        })
      }
      await channel.permissionOverwrites.delete(user.id, `unhide-channel: ${reason}`)
      db.removeTempChannelHide(interaction.guild.id, channel.id, user.id)

      logModAction(interaction, {
        action_type: 'channel_unhide',
        user,
        reason: `[#${channel.name}] ${reason}`,
      })

      await interaction.reply(`👁️ Đã gỡ ẩn <#${channel.id}> đối với **${user.tag}**.\n📝 Lý do: ${reason}`)
    } catch (err) {
      console.error('[unhide-channel]', err)
      await interaction.reply({ content: `❌ Lỗi: ${err.message}`, ephemeral: true })
    }
  },
}
