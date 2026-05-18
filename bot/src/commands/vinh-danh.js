// /vinhdanh — vinh danh thanh vien
// Subcommand:
//   /vinhdanh ca-nhan  — Top 3 Champion Spotlight (giu nguyen hanh vi cu)
//   /vinhdanh team     — Team Roster (1-10 thanh vien)
const {
  SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  PermissionFlagsBits,
} = require('discord.js')
const dbHonor = require('../../../shared/db-honor')
const honorService = require('../services/honor-service')

// ============================================================
// Helper
// ============================================================
function defaultTitle(prefix = 'BẢNG VÀNG') {
  const now = new Date()
  const mm = now.getMonth() + 1
  const yyyy = now.getFullYear()
  return `${prefix} THÁNG ${mm}/${yyyy}`
}

// ============================================================
// Modal builders
// ============================================================
function buildTop3Modal(nonce) {
  return new ModalBuilder()
    .setCustomId(`honor:modal:top3:${nonce}`)
    .setTitle('Vinh danh Top 3')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('title').setLabel('Tiêu đề')
          .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)
          .setValue(defaultTitle()),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason1').setLabel('🥇 Lý do vinh danh Quán quân')
          .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason2').setLabel('🥈 Lý do vinh danh Á quân')
          .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason3').setLabel('🥉 Lý do vinh danh Hạng ba')
          .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300),
      ),
    )
}

function buildTeamModal(nonce) {
  return new ModalBuilder()
    .setCustomId(`honor:modal:team:${nonce}`)
    .setTitle('Vinh danh Team')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('title').setLabel('Tiêu đề')
          .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)
          .setValue(defaultTitle('BẢNG VÀNG TEAM')),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('teamName').setLabel('Tên team')
          .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)
          .setPlaceholder('vd: Biệt đội Bug Hunter'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('Lý do vinh danh team')
          .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500),
      ),
    )
}

// ============================================================
// Slash data — subcommand ca-nhan + team
// ============================================================
const data = new SlashCommandBuilder()
  .setName('vinhdanh')
  .setDescription('Vinh danh thành viên xuất sắc (cá nhân Top 3 hoặc team)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('ca-nhan')
    .setDescription('Vinh danh Top 3 cá nhân (Champion Spotlight)')
    .addUserOption(o => o.setName('user1').setDescription('🥇 Quán quân (#1)').setRequired(true))
    .addUserOption(o => o.setName('user2').setDescription('🥈 Á quân (#2)').setRequired(true))
    .addUserOption(o => o.setName('user3').setDescription('🥉 Hạng ba (#3)').setRequired(true))
    .addAttachmentOption(o => o.setName('banner').setDescription('Ảnh banner đi kèm').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel đăng (mặc định: hiện tại)')))
  .addSubcommand(sub => {
    sub.setName('team')
      .setDescription('Vinh danh team (1-10 thành viên)')
      .addUserOption(o => o.setName('user1').setDescription('Thành viên #1').setRequired(true))
    for (let i = 2; i <= 10; i++) {
      sub.addUserOption(o => o.setName(`user${i}`).setDescription(`Thành viên #${i} (optional)`))
    }
    sub.addAttachmentOption(o => o.setName('banner').setDescription('Ảnh banner đi kèm').setRequired(true))
    sub.addChannelOption(o => o.setName('channel').setDescription('Channel đăng (mặc định: hiện tại)'))
    return sub
  })

// ============================================================
// Common: permission check + validate banner + channel
// ============================================================
function ensurePermissionAndChannel(interaction) {
  const guild = interaction.guild
  if (!guild) {
    return { error: '❌ Lệnh này chỉ dùng trong server.' }
  }
  const settings = dbHonor.getHonorSettings(guild.id)
  if (!honorService.hasHonorPermission(interaction.member, settings)) {
    return { error: '🚫 Bạn không có quyền dùng lệnh vinh danh. Liên hệ admin để được cấp role.' }
  }
  const banner = interaction.options.getAttachment('banner', true)
  if (!banner.contentType || !banner.contentType.startsWith('image/')) {
    return { error: '❌ File banner phải là ảnh (image/*).' }
  }
  const channelOpt = interaction.options.getChannel('channel')
  const targetChannel = channelOpt || interaction.channel
  if (!targetChannel?.isTextBased?.()) {
    return { error: '❌ Channel đích không phải text channel.' }
  }
  return { guild, banner, targetChannel }
}

// ============================================================
// execute — dispatch theo subcommand
// ============================================================
async function execute(interaction) {
  const sub = interaction.options.getSubcommand()
  if (sub === 'ca-nhan') return executeCaNhan(interaction)
  if (sub === 'team') return executeTeam(interaction)
}

// ============================================================
// Subcommand: ca-nhan (Top 3)
// ============================================================
async function executeCaNhan(interaction) {
  const ctx = ensurePermissionAndChannel(interaction)
  if (ctx.error) return interaction.reply({ content: ctx.error, ephemeral: true })

  const user1 = interaction.options.getUser('user1', true)
  const user2 = interaction.options.getUser('user2', true)
  const user3 = interaction.options.getUser('user3', true)
  const ids = [user1.id, user2.id, user3.id]
  if (new Set(ids).size !== 3) {
    return interaction.reply({ content: '❌ 3 vị trí phải là 3 thành viên khác nhau.', ephemeral: true })
  }

  const nonce = interaction.user.id
  honorService.setPending(`${nonce}:${ctx.guild.id}:top3`, {
    user1Id: user1.id,
    user2Id: user2.id,
    user3Id: user3.id,
    bannerUrl: ctx.banner.url,
    targetChannelId: ctx.targetChannel.id,
  })

  return interaction.showModal(buildTop3Modal(nonce))
}

// ============================================================
// Subcommand: team
// ============================================================
async function executeTeam(interaction) {
  const ctx = ensurePermissionAndChannel(interaction)
  if (ctx.error) return interaction.reply({ content: ctx.error, ephemeral: true })

  const memberIds = []
  for (let i = 1; i <= 10; i++) {
    const u = interaction.options.getUser(`user${i}`)
    if (u) memberIds.push(u.id)
  }
  // Dedupe giu thu tu
  const uniq = [...new Set(memberIds)]
  if (uniq.length !== memberIds.length) {
    return interaction.reply({ content: '❌ Có thành viên bị trùng — vui lòng nhập 1 lần.', ephemeral: true })
  }
  if (uniq.length < 1 || uniq.length > 10) {
    return interaction.reply({ content: '❌ Team phải có 1-10 thành viên.', ephemeral: true })
  }

  const nonce = interaction.user.id
  honorService.setPending(`${nonce}:${ctx.guild.id}:team`, {
    memberIds: uniq,
    bannerUrl: ctx.banner.url,
    targetChannelId: ctx.targetChannel.id,
  })

  return interaction.showModal(buildTeamModal(nonce))
}

// ============================================================
// Modal submit dispatcher
// ============================================================
async function handleModalSubmit(interaction) {
  // customId: honor:modal:<type>:<nonce>
  const parts = interaction.customId.split(':')
  const type = parts[2]
  const nonce = parts[3]
  if (type === 'top3') return handleTop3Submit(interaction, nonce)
  if (type === 'team') return handleTeamSubmit(interaction, nonce)
}

// ============================================================
// handleTop3Submit
// ============================================================
async function handleTop3Submit(interaction, nonce) {
  const guild = interaction.guild
  if (!guild) return
  await interaction.deferReply({ ephemeral: true })

  const pending = honorService.takePending(`${nonce}:${guild.id}:top3`)
  if (!pending) {
    return interaction.editReply({
      content: '⏱️ Phiên nhập đã hết hạn. Vui lòng gõ `/vinhdanh ca-nhan` lại.',
    })
  }

  const title = interaction.fields.getTextInputValue('title').trim()
  const reason1 = interaction.fields.getTextInputValue('reason1').trim()
  const reason2 = interaction.fields.getTextInputValue('reason2').trim()
  const reason3 = interaction.fields.getTextInputValue('reason3').trim()
  if (!title || !reason1 || !reason2 || !reason3) {
    return interaction.editReply({ content: '❌ Tất cả các trường đều bắt buộc.' })
  }

  const [u1, u2, u3] = await Promise.all([
    interaction.client.users.fetch(pending.user1Id).catch(() => null),
    interaction.client.users.fetch(pending.user2Id).catch(() => null),
    interaction.client.users.fetch(pending.user3Id).catch(() => null),
  ])
  if (!u1 || !u2 || !u3) {
    return interaction.editReply({ content: '❌ Không tìm thấy thông tin 1 trong 3 thành viên.' })
  }

  const buildName = async (u) => {
    const member = await guild.members.fetch(u.id).catch(() => null)
    return member?.nickname || u.globalName || u.username
  }
  const [n1, n2, n3] = await Promise.all([buildName(u1), buildName(u2), buildName(u3)])

  const targetChannel = await interaction.client.channels.fetch(pending.targetChannelId).catch(() => null)
  if (!targetChannel) {
    return interaction.editReply({ content: '❌ Không tìm thấy channel đích.' })
  }

  const payload = honorService.buildHonorEmbed({
    title,
    guildName: guild.name,
    guildIconUrl: guild.iconURL({ size: 128 }) || undefined,
    user1: { id: u1.id, name: n1, avatarUrl: u1.displayAvatarURL({ size: 256 }), reason: reason1 },
    user2: { id: u2.id, name: n2, avatarUrl: u2.displayAvatarURL({ size: 256 }), reason: reason2 },
    user3: { id: u3.id, name: n3, avatarUrl: u3.displayAvatarURL({ size: 256 }), reason: reason3 },
    bannerUrl: pending.bannerUrl,
  })

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
    const link = `https://discord.com/channels/${guild.id}/${targetChannel.id}/${messageId}`
    return interaction.editReply({ content: `✅ Đã gửi vinh danh cá nhân tới <#${targetChannel.id}>. [Xem](${link})` })
  } catch (err) {
    console.error('[vinhdanh ca-nhan] publish failed:', err)
    return interaction.editReply({ content: `❌ Lỗi khi gửi: ${err.message}` })
  }
}

// ============================================================
// handleTeamSubmit
// ============================================================
async function handleTeamSubmit(interaction, nonce) {
  const guild = interaction.guild
  if (!guild) return
  await interaction.deferReply({ ephemeral: true })

  const pending = honorService.takePending(`${nonce}:${guild.id}:team`)
  if (!pending) {
    return interaction.editReply({
      content: '⏱️ Phiên nhập đã hết hạn. Vui lòng gõ `/vinhdanh team` lại.',
    })
  }

  const title = interaction.fields.getTextInputValue('title').trim()
  const teamName = interaction.fields.getTextInputValue('teamName').trim()
  const reason = interaction.fields.getTextInputValue('reason').trim()
  if (!title || !teamName || !reason) {
    return interaction.editReply({ content: '❌ Tất cả các trường đều bắt buộc.' })
  }

  // Fetch all members song song
  const users = await Promise.all(
    pending.memberIds.map(id => interaction.client.users.fetch(id).catch(() => null)),
  )
  if (users.some(u => !u)) {
    return interaction.editReply({ content: '❌ Không tìm thấy thông tin 1 trong các thành viên.' })
  }

  const targetChannel = await interaction.client.channels.fetch(pending.targetChannelId).catch(() => null)
  if (!targetChannel) {
    return interaction.editReply({ content: '❌ Không tìm thấy channel đích.' })
  }

  const members = users.map(u => ({ id: u.id }))

  const payload = honorService.buildHonorTeamEmbed({
    title,
    guildName: guild.name,
    guildIconUrl: guild.iconURL({ size: 128 }) || undefined,
    teamName,
    reason,
    bannerUrl: pending.bannerUrl,
    members,
  })

  const dbRecord = {
    guild_id: guild.id,
    channel_id: targetChannel.id,
    title,
    team_name: teamName,
    reason,
    banner_url: pending.bannerUrl,
    member_ids: pending.memberIds,
    created_by: interaction.user.id,
  }

  try {
    const { messageId } = await honorService.publishHonorTeam({ channel: targetChannel, payload, dbRecord })
    const link = `https://discord.com/channels/${guild.id}/${targetChannel.id}/${messageId}`
    return interaction.editReply({
      content: `✅ Đã gửi vinh danh team **${teamName}** tới <#${targetChannel.id}>. [Xem](${link})`,
    })
  } catch (err) {
    console.error('[vinhdanh team] publish failed:', err)
    return interaction.editReply({ content: `❌ Lỗi khi gửi: ${err.message}` })
  }
}

module.exports = { data, execute, handleModalSubmit }
