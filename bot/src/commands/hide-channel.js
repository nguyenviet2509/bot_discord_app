const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js')
const db = require('../../../shared/db')
const { parseDuration, formatDuration } = require('../utils/parse-duration')
const logModAction = require('../utils/log-mod-action')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hide-channel')
    .setDescription('Ẩn 1 kênh đối với 1 thành viên (có thể đặt thời hạn)')
    .addUserOption(opt => opt.setName('user').setDescription('Thành viên cần ẩn kênh').setRequired(true))
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Kênh cần ẩn (mặc định = kênh hiện tại)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildForum, ChannelType.GuildStageVoice)
    )
    .addStringOption(opt => opt.setName('duration').setDescription('Thời hạn (vd: 30m, 2h, 7d). Bỏ trống = vĩnh viễn'))
    .addStringOption(opt => opt.setName('reason').setDescription('Lý do'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const user = interaction.options.getUser('user')
    const channel = interaction.options.getChannel('channel') || interaction.channel
    const durationStr = interaction.options.getString('duration')
    const reason = interaction.options.getString('reason') || 'Không có lý do'

    let durationMs = null
    if (durationStr) {
      durationMs = parseDuration(durationStr)
      if (!durationMs) {
        return interaction.reply({
          content: '❌ Định dạng thời gian sai. Dùng: `30m`, `2h`, `7d` (s/m/h/d).',
          ephemeral: true,
        })
      }
    }

    try {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null)
      if (member && member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: `⚠️ **${user.tag}** có quyền Administrator nên permission overwrite không có tác dụng. Hãy gỡ role Admin trước.`,
          ephemeral: true,
        })
      }

      await channel.permissionOverwrites.edit(user.id, { ViewChannel: false }, { reason: `hide-channel: ${reason}` })

      const expiresAt = durationMs ? Math.floor((Date.now() + durationMs) / 1000) : null
      if (durationMs) {
        db.addTempChannelHide(interaction.guild.id, channel.id, user.id, expiresAt, reason)
      } else {
        db.removeTempChannelHide(interaction.guild.id, channel.id, user.id)
      }

      logModAction(interaction, {
        action_type: 'channel_hide',
        user,
        reason: `[#${channel.name}] ${reason}`,
        duration_ms: durationMs,
        expires_at: expiresAt,
      })

      if (durationMs) {
        await interaction.reply(
          `🙈 Đã ẩn <#${channel.id}> đối với **${user.tag}** trong **${formatDuration(durationMs)}**.\n📝 Lý do: ${reason}\n⏰ Tự hiện lại: <t:${expiresAt}:R>`
        )
      } else {
        await interaction.reply(`🙈 Đã ẩn <#${channel.id}> đối với **${user.tag}** (vĩnh viễn cho tới khi /unhide-channel).\n📝 Lý do: ${reason}`)
      }
    } catch (err) {
      console.error('[hide-channel]', err)
      await interaction.reply({ content: `❌ Lỗi: ${err.message}`, ephemeral: true })
    }
  },
}
