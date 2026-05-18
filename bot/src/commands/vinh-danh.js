// /vinhdanh — vinh danh Top 3 thanh vien dong gop xuat sac
// Flow: slash command voi 3 user + banner -> hien modal nhap tieu de + 3 ly do -> publish embed
const {
  SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  PermissionFlagsBits,
} = require('discord.js')
const dbHonor = require('../../../shared/db-honor')
const honorService = require('../services/honor-service')

// ============================================================
// Helper: default tieu de "BANG VANG THANG MM/YYYY" theo thoi gian VN
// ============================================================
function defaultTitle() {
  const now = new Date()
  const mm = now.getMonth() + 1
  const yyyy = now.getFullYear()
  return `BẢNG VÀNG THÁNG ${mm}/${yyyy}`
}

// ============================================================
// Build modal voi 4 input: title + 3 reasons
// ============================================================
function buildHonorModal(nonce) {
  return new ModalBuilder()
    .setCustomId(`honor:modal:${nonce}`)
    .setTitle('Vinh danh Top 3')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Tiêu đề')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80)
          .setValue(defaultTitle()),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason1')
          .setLabel('🥇 Lý do vinh danh Quán quân')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(300),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason2')
          .setLabel('🥈 Lý do vinh danh Á quân')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(300),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason3')
          .setLabel('🥉 Lý do vinh danh Hạng ba')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(300),
      ),
    )
}

// ============================================================
// Slash data
// ============================================================
const data = new SlashCommandBuilder()
  .setName('vinhdanh')
  .setDescription('Vinh danh Top 3 thành viên đóng góp xuất sắc nhất')
  .addUserOption(o => o.setName('user1').setDescription('🥇 Quán quân (#1)').setRequired(true))
  .addUserOption(o => o.setName('user2').setDescription('🥈 Á quân (#2)').setRequired(true))
  .addUserOption(o => o.setName('user3').setDescription('🥉 Hạng ba (#3)').setRequired(true))
  .addAttachmentOption(o => o.setName('banner').setDescription('Ảnh banner đi kèm thông báo').setRequired(true))
  .addChannelOption(o => o.setName('channel').setDescription('Channel đăng (mặc định: channel hiện tại)'))
  // Hide khoi @everyone, gan voi permission ManageGuild → custom role check trong execute
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

// ============================================================
// execute — mo modal sau khi validate
// ============================================================
async function execute(interaction) {
  const guild = interaction.guild
  if (!guild) {
    return interaction.reply({ content: '❌ Lệnh này chỉ dùng trong server.', ephemeral: true })
  }

  // Permission check
  const settings = dbHonor.getHonorSettings(guild.id)
  if (!honorService.hasHonorPermission(interaction.member, settings)) {
    return interaction.reply({
      content: '🚫 Bạn không có quyền dùng lệnh vinh danh. Liên hệ admin để được cấp role.',
      ephemeral: true,
    })
  }

  const user1 = interaction.options.getUser('user1', true)
  const user2 = interaction.options.getUser('user2', true)
  const user3 = interaction.options.getUser('user3', true)
  const banner = interaction.options.getAttachment('banner', true)
  const channelOpt = interaction.options.getChannel('channel')

  // Validate 3 user khong trung
  const ids = [user1.id, user2.id, user3.id]
  if (new Set(ids).size !== 3) {
    return interaction.reply({ content: '❌ 3 vị trí phải là 3 thành viên khác nhau.', ephemeral: true })
  }

  // Validate banner phai la image
  if (!banner.contentType || !banner.contentType.startsWith('image/')) {
    return interaction.reply({ content: '❌ File banner phải là ảnh (image/*).', ephemeral: true })
  }

  // Channel target
  const targetChannel = channelOpt || interaction.channel
  if (!targetChannel?.isTextBased?.()) {
    return interaction.reply({ content: '❌ Channel đích không phải text channel.', ephemeral: true })
  }

  // Luu pending data — nonce = userId (mot user chi co 1 pending tai 1 thoi diem)
  const nonce = interaction.user.id
  honorService.setPending(`${nonce}:${guild.id}`, {
    user1Id: user1.id,
    user2Id: user2.id,
    user3Id: user3.id,
    bannerUrl: banner.url,
    targetChannelId: targetChannel.id,
  })

  return interaction.showModal(buildHonorModal(nonce))
}

// ============================================================
// handleModalSubmit — duoc goi tu events/interaction-create.js khi customId match honor:modal:*
// ============================================================
async function handleModalSubmit(interaction) {
  const guild = interaction.guild
  if (!guild) return

  await interaction.deferReply({ ephemeral: true })

  const nonce = interaction.customId.split(':')[2]
  const pending = honorService.takePending(`${nonce}:${guild.id}`)
  if (!pending) {
    return interaction.editReply({
      content: '⏱️ Phiên nhập đã hết hạn hoặc không tìm thấy dữ liệu. Vui lòng gõ `/vinhdanh` lại.',
    })
  }

  const title = interaction.fields.getTextInputValue('title').trim()
  const reason1 = interaction.fields.getTextInputValue('reason1').trim()
  const reason2 = interaction.fields.getTextInputValue('reason2').trim()
  const reason3 = interaction.fields.getTextInputValue('reason3').trim()

  if (!title || !reason1 || !reason2 || !reason3) {
    return interaction.editReply({ content: '❌ Tất cả các trường đều bắt buộc.' })
  }

  // Fetch user objects
  const [u1, u2, u3] = await Promise.all([
    interaction.client.users.fetch(pending.user1Id).catch(() => null),
    interaction.client.users.fetch(pending.user2Id).catch(() => null),
    interaction.client.users.fetch(pending.user3Id).catch(() => null),
  ])
  if (!u1 || !u2 || !u3) {
    return interaction.editReply({ content: '❌ Không tìm thấy thông tin 1 trong 3 thành viên.' })
  }

  // Build display name (ưu tiên member nickname > global_name > username)
  const buildName = async (u) => {
    const member = await guild.members.fetch(u.id).catch(() => null)
    return member?.nickname || u.globalName || u.username
  }
  const [n1, n2, n3] = await Promise.all([buildName(u1), buildName(u2), buildName(u3)])

  const targetChannel = await interaction.client.channels.fetch(pending.targetChannelId).catch(() => null)
  if (!targetChannel) {
    return interaction.editReply({ content: '❌ Không tìm thấy channel đích.' })
  }

  // Build payload
  const payload = honorService.buildHonorEmbed({
    title,
    guildName: guild.name,
    guildIconUrl: guild.iconURL({ size: 128 }) || undefined,
    user1: { id: u1.id, name: n1, avatarUrl: u1.displayAvatarURL({ size: 256 }), reason: reason1 },
    user2: { id: u2.id, name: n2, avatarUrl: u2.displayAvatarURL({ size: 256 }), reason: reason2 },
    user3: { id: u3.id, name: n3, avatarUrl: u3.displayAvatarURL({ size: 256 }), reason: reason3 },
    bannerUrl: pending.bannerUrl,
  })

  // DB record
  const dbRecord = {
    guild_id: guild.id,
    channel_id: targetChannel.id,
    title,
    banner_url: pending.bannerUrl,
    user1_id: u1.id, user1_reason: reason1,
    user2_id: u2.id, user2_reason: reason2,
    user3_id: u3.id, user3_reason: reason3,
    created_by: interaction.user.id,
  }

  try {
    const { messageId } = await honorService.publishHonor({ channel: targetChannel, payload, dbRecord })
    const messageLink = `https://discord.com/channels/${guild.id}/${targetChannel.id}/${messageId}`
    return interaction.editReply({
      content: `✅ Đã gửi vinh danh tới <#${targetChannel.id}>. [Xem](${messageLink})`,
    })
  } catch (err) {
    console.error('[vinhdanh] publish failed:', err)
    return interaction.editReply({ content: `❌ Lỗi khi gửi: ${err.message}` })
  }
}

module.exports = { data, execute, handleModalSubmit }
