// Admin command: cau hinh post approval flow (entry channel, review channel, public forum, admin roles)
const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const db = require('../../../shared/db')

// Permission cua bot can co o tung loai channel
const BOT_PERMS_TEXT = ['ViewChannel', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory']
const BOT_PERMS_FORUM = ['ViewChannel', 'CreatePublicThreads', 'SendMessagesInThreads', 'ManageThreads', 'EmbedLinks']

function checkBotPerms(channel, perms) {
  const me = channel.guild.members.me
  if (!me) return perms
  const missing = []
  for (const p of perms) {
    if (!channel.permissionsFor(me)?.has(PermissionFlagsBits[p])) missing.push(p)
  }
  return missing
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('post-setup')
    .setDescription('Cấu hình hệ thống duyệt bài đăng')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('channels')
        .setDescription('Set 3 channel: entry (member /post), review (admin duyệt), public (forum)')
        .addChannelOption(o => o.setName('entry').setDescription('Text channel nơi member chạy /post').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('review').setDescription('Text channel queue duyệt (chỉ admin xem)').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('public').setDescription('Forum channel cho bài đã duyệt').setRequired(true).addChannelTypes(ChannelType.GuildForum))
    )
    .addSubcommand(sub =>
      sub.setName('admin-role')
        .setDescription('Quản lý role được duyệt bài')
        .addRoleOption(o => o.setName('role').setDescription('Role admin').setRequired(true))
        .addStringOption(o => o.setName('action').setDescription('Hành động').setRequired(true)
          .addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }))
    )
    .addSubcommand(sub => sub.setName('show').setDescription('Hiển thị cấu hình hiện tại'))
    .addSubcommand(sub =>
      sub.setName('panel').setDescription('Tạo + ghim panel button trong entry channel để member không cần gõ lệnh')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'channels') {
      const entry = interaction.options.getChannel('entry')
      const review = interaction.options.getChannel('review')
      const publicForum = interaction.options.getChannel('public')

      const missing = []
      const m1 = checkBotPerms(entry, BOT_PERMS_TEXT); if (m1.length) missing.push(`#${entry.name}: ${m1.join(', ')}`)
      const m2 = checkBotPerms(review, BOT_PERMS_TEXT); if (m2.length) missing.push(`#${review.name}: ${m2.join(', ')}`)
      const m3 = checkBotPerms(publicForum, BOT_PERMS_FORUM); if (m3.length) missing.push(`#${publicForum.name}: ${m3.join(', ')}`)

      if (missing.length) {
        return interaction.reply({
          content: `❌ Bot thiếu permission:\n${missing.map(s => `• ${s}`).join('\n')}`,
          ephemeral: true,
        })
      }

      db.updatePostSettings(guildId, {
        post_entry_channel_id: entry.id,
        review_channel_id: review.id,
        public_forum_id: publicForum.id,
      })

      const embed = new EmbedBuilder()
        .setColor(0x248046)
        .setTitle('✅ Đã lưu cấu hình channels')
        .addFields(
          { name: '📝 Entry (member /post)', value: `<#${entry.id}>`, inline: false },
          { name: '⏳ Review (admin duyệt)', value: `<#${review.id}>`, inline: false },
          { name: '📢 Public Forum', value: `<#${publicForum.id}>`, inline: false },
        )
      return interaction.reply({ embeds: [embed], ephemeral: true })
    }

    if (sub === 'admin-role') {
      const role = interaction.options.getRole('role')
      const action = interaction.options.getString('action')
      const settings = db.getSettings(guildId) || {}
      const current = Array.isArray(settings.post_admin_role_ids) ? [...settings.post_admin_role_ids] : []
      let next
      if (action === 'add') {
        next = current.includes(role.id) ? current : [...current, role.id]
      } else {
        next = current.filter(id => id !== role.id)
      }
      db.updatePostSettings(guildId, { post_admin_role_ids: next })
      return interaction.reply({
        content: `✅ ${action === 'add' ? 'Thêm' : 'Xoá'} role <@&${role.id}>. Tổng: ${next.length} role.`,
        ephemeral: true,
      })
    }

    if (sub === 'panel') {
      const s = db.getSettings(guildId) || {}
      if (!s.post_entry_channel_id) {
        return interaction.reply({ content: '❌ Chưa set entry channel. Chạy `/post-setup channels` trước.', ephemeral: true })
      }
      const entryCh = await interaction.guild.channels.fetch(s.post_entry_channel_id).catch(() => null)
      if (!entryCh) return interaction.reply({ content: '❌ Entry channel không tồn tại.', ephemeral: true })

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📋 Bảng đăng bài')
        .setDescription([
          'Bấm nút bên dưới để đăng bài hoặc quản lý bài của bạn.',
          '',
          '📝 **Đăng bài (text)** — bài không kèm ảnh',
          '🖼️ **Đăng bài (có ảnh)** — sau khi điền form, bạn sẽ được mời gửi ảnh trong 60 giây',
          '🗂️ **Bài của tôi** — sửa nội dung, đổi/xoá ảnh, xoá bài của chính bạn',
          '',
          '_Bài được gửi đến admin duyệt trước khi public._',
        ].join('\n'))

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('post:open-create').setLabel('Đăng bài').setEmoji('📝').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('post:open-create-img').setLabel('Đăng bài (có ảnh)').setEmoji('🖼️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('post:open-my-posts').setLabel('Bài của tôi').setEmoji('🗂️').setStyle(ButtonStyle.Secondary),
      )

      const msg = await entryCh.send({ embeds: [embed], components: [row] })
      await msg.pin('Post approval panel').catch(() => {})
      return interaction.reply({ content: `✅ Đã tạo + ghim panel trong <#${entryCh.id}>.`, ephemeral: true })
    }

    if (sub === 'show') {
      const s = db.getSettings(guildId) || {}
      const fmt = id => id ? `<#${id}>` : '*(chưa set)*'
      const roles = (s.post_admin_role_ids || []).map(id => `<@&${id}>`).join(', ') || '*(chưa set)*'
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('⚙️ Cấu hình Post Approval')
        .addFields(
          { name: '📝 Entry channel', value: fmt(s.post_entry_channel_id), inline: false },
          { name: '⏳ Review channel', value: fmt(s.review_channel_id), inline: false },
          { name: '📢 Public forum', value: fmt(s.public_forum_id), inline: false },
          { name: '👮 Admin roles', value: roles, inline: false },
        )
      return interaction.reply({ embeds: [embed], ephemeral: true })
    }
  },
}
