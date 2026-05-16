// Event handler tap trung cho tat ca interaction (slash, modal, button, select, autocomplete)
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js')
const db = require('../../../shared/db')
const dbMg = require('../../../shared/db-mini-game')
const dbPosts = require('../../../shared/db-posts')
const postService = require('../services/post-service')
const { takePending } = require('../utils/pending-image-cache')
const { buildCreateModal } = require('../commands/post')
const { buildEditModal, checkEditAccess } = require('../commands/post-edit')

// Build chip mention `</name:id>` -> hien thi nhu chip click duoc, mo slash command native
function chip(client, name) {
  const id = client.commandIds?.[name]
  return id ? `</${name}:${id}>` : `\`/${name}\``
}

// ============================================================
// Slash command
// ============================================================
async function handleSlashCommand(interaction, client) {
  const command = client.commands.get(interaction.commandName)
  if (!command) return

  if (interaction.guild) {
    const settings = db.getSettings(interaction.guild.id)
    const allowed = settings?.allowed_role_ids || []
    if (!db.memberHasAccess(interaction.member, allowed)) {
      return interaction.reply({
        content: '🚫 Bạn không có quyền sử dụng bot này. Liên hệ admin để được cấp role.',
        ephemeral: true,
      }).catch(() => {})
    }
  }

  // Module gate: command thuoc module phai duoc enable cho guild
  const moduleKey = command._module
  if (moduleKey && interaction.guild) {
    const manifest = client._modules?.get(moduleKey)
    const dbState = dbMg.isModuleEnabled(interaction.guild.id, moduleKey)
    const enabled = dbState === null ? !!manifest?.defaultEnabled : dbState
    if (!enabled) {
      return interaction.reply({
        content: `⚠️ Module **${manifest?.name || moduleKey}** chưa được bật cho server này. Liên hệ admin để bật.`,
        ephemeral: true,
      }).catch(() => {})
    }
  }

  try {
    await command.execute(interaction)
  } catch (err) {
    console.error(`[Command Error] /${interaction.commandName}:`, err)
    const msg = { content: '❌ Có lỗi xảy ra khi thực hiện lệnh này.', ephemeral: true }
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {})
    } else {
      await interaction.reply(msg).catch(() => {})
    }
  }
}

// ============================================================
// Modal submit
// ============================================================
function readCreateFields(interaction) {
  return {
    title: interaction.fields.getTextInputValue('title').trim(),
    content: interaction.fields.getTextInputValue('content').trim(),
    price: interaction.fields.getTextInputValue('price')?.trim() || null,
    contact: interaction.fields.getTextInputValue('contact')?.trim() || null,
  }
}

async function handleModalSubmit(interaction) {
  const id = interaction.customId

  // Tao bai (text-only hoac da co anh tu /post-image)
  if (id === 'post:create-modal') {
    await interaction.deferReply({ ephemeral: true })
    const fields = readCreateFields(interaction)
    fields.image_url = takePending(`${interaction.user.id}:create`) || null
    const result = await postService.createPendingPost(interaction, fields)
    if (result.error) return interaction.editReply({ content: `❌ ${result.error}` })
    return interaction.editReply({ content: `✅ Bài đăng **#${result.postId}** đã gửi duyệt${fields.image_url ? ' (kèm ảnh)' : ''}. Bạn sẽ nhận thông báo khi có kết quả.` })
  }

  // Sua bai - apply pending image action neu co (tu /post-edit-image hoac /post-edit remove_image)
  if (id.startsWith('post:edit-modal:')) {
    const postId = parseInt(id.split(':')[2], 10)
    await interaction.deferReply({ ephemeral: true })
    const fields = readCreateFields(interaction)
    const post = dbPosts.getPost(postId)
    if (!post) return interaction.editReply({ content: '❌ Bài không tồn tại.' })

    const pendingImage = takePending(`${interaction.user.id}:edit:${postId}`)
    if (pendingImage === '__REMOVE__') fields.clear_image = true
    else if (pendingImage) fields.image_url = pendingImage

    const result = await postService.editPost(interaction, postId, fields)
    if (result.error) return interaction.editReply({ content: `❌ ${result.error}` })
    const note = result.restatus === 'pending'
      ? '✅ Bài đã cập nhật, chuyển sang chờ duyệt lại.'
      : '✅ Bài đã cập nhật.'
    return interaction.editReply({ content: note })
  }

  // Reject modal (admin)
  if (id.startsWith('post:reject-modal:')) {
    const postId = parseInt(id.split(':')[2], 10)
    await interaction.deferUpdate()
    const reasonText = interaction.fields.getTextInputValue('reason').trim()
    const result = await postService.rejectPost(interaction, postId, reasonText)
    if (result.error) return interaction.followUp({ content: `❌ ${result.error}`, ephemeral: true })
    return interaction.followUp({ content: `✅ Đã từ chối bài #${postId}.`, ephemeral: true })
  }
}

// ============================================================
// Button
// ============================================================
async function handleButton(interaction) {
  const id = interaction.customId

  // Module button handlers (mg:..., other modules in future) duoc dang ky qua _moduleButtonHandlers
  const moduleHandlers = interaction.client._moduleButtonHandlers || []
  for (const handler of moduleHandlers) {
    try {
      const handled = await handler(interaction)
      if (handled) return
    } catch (err) {
      console.error('[ModuleButton]', err)
    }
  }

  if (!id.startsWith('post:')) return

  const parts = id.split(':')
  const action = parts[1]
  const param = parts[2]
  const postIdInt = param ? parseInt(param, 10) : null
  const client = interaction.client

  // === Panel: dang bai text-only ===
  if (action === 'open-create') {
    return interaction.showModal(buildCreateModal('post:create-modal'))
  }

  // === Panel: dang bai co anh -> route sang slash command (co chip image native) ===
  if (action === 'open-create-img') {
    return interaction.reply({
      content: `🖼️ **Để đăng bài có ảnh,** vui lòng bấm vào ${chip(client, 'post-image')} bên dưới.\n• Bấm vào chip → chọn ảnh từ máy → điền thông tin → gửi.\n• Ảnh tối đa **1MB**.`,
      ephemeral: true,
    })
  }

  // === Panel: bai cua toi ===
  if (action === 'open-my-posts') {
    const posts = dbPosts.getPostsByAuthor(interaction.guild.id, interaction.user.id, ['pending', 'approved'])
    if (!posts.length) return interaction.reply({ content: '📭 Bạn chưa có bài đăng nào.', ephemeral: true })
    const menu = new StringSelectMenuBuilder()
      .setCustomId('post:my-posts-select')
      .setPlaceholder('Chọn bài...')
      .addOptions(posts.slice(0, 25).map(p => ({
        label: `#${p.id} · ${p.title.slice(0, 80)}`,
        description: `[${p.status}] ${(p.content || '').slice(0, 80)}`,
        value: String(p.id),
      })))
    return interaction.reply({
      content: '🗂️ **Bài của bạn** — chọn 1 bài:',
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true,
    })
  }

  // === My post: sua text ===
  if (action === 'my-edit' && postIdInt) {
    const post = dbPosts.getPost(postIdInt)
    const err = checkEditAccess(interaction, post)
    if (err) return interaction.reply({ content: err, ephemeral: true })
    return interaction.showModal(buildEditModal(post))
  }

  // === My post: xoa anh ===
  if (action === 'my-clear-img' && postIdInt) {
    await interaction.deferUpdate()
    const post = dbPosts.getPost(postIdInt)
    const err = checkEditAccess(interaction, post)
    if (err) return interaction.editReply({ content: err, components: [], embeds: [] })
    if (!post.image_url) return interaction.editReply({ content: 'Bài không có ảnh để xoá.', components: [], embeds: [] })
    const result = await postService.editPost(interaction, postIdInt, {
      title: post.title, content: post.content, price: post.price, contact: post.contact,
      clear_image: true,
    })
    if (result.error) return interaction.editReply({ content: `❌ ${result.error}`, components: [], embeds: [] })
    return interaction.editReply({ content: `✅ Đã xoá ảnh của bài #${postIdInt}. ${result.restatus === 'pending' ? 'Bài chuyển sang chờ duyệt lại.' : ''}`, components: [], embeds: [] })
  }

  // === My post: xoa bai ===
  if (action === 'my-delete' && postIdInt) {
    await interaction.deferUpdate()
    const result = await postService.deletePost(interaction, postIdInt)
    if (result.error) return interaction.editReply({ content: `❌ ${result.error}`, components: [], embeds: [] })
    return interaction.editReply({ content: `✅ Đã xoá bài #${postIdInt}.`, components: [], embeds: [] })
  }

  // === Admin approve/reject ===
  if (action === 'approve' && postIdInt) {
    await interaction.deferReply({ ephemeral: true })
    const result = await postService.approvePost(interaction, postIdInt)
    if (result.error) return interaction.editReply({ content: `❌ ${result.error}` })
    return interaction.editReply({ content: `✅ Đã duyệt bài #${postIdInt}. Thread: ${result.thread.url}` })
  }
  if (action === 'reject' && postIdInt) {
    const modal = new ModalBuilder()
      .setCustomId(`post:reject-modal:${postIdInt}`)
      .setTitle(`Từ chối bài #${postIdInt}`)
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('reason').setLabel('Lý do từ chối').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
        ),
      )
    return interaction.showModal(modal)
  }
}

// ============================================================
// Select menu (bai cua toi)
// ============================================================
async function handleSelectMenu(interaction) {
  if (interaction.customId !== 'post:my-posts-select') return
  const postId = parseInt(interaction.values[0], 10)
  const post = dbPosts.getPost(postId)
  if (!post || post.author_id !== interaction.user.id) {
    return interaction.update({ content: '❌ Bài không tồn tại hoặc không phải của bạn.', components: [], embeds: [] })
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`post:my-edit:${postId}`).setLabel('Sửa text').setEmoji('✏️').setStyle(ButtonStyle.Primary),
  )
  if (post.image_url) {
    row.addComponents(
      new ButtonBuilder().setCustomId(`post:my-clear-img:${postId}`).setLabel('Xoá ảnh').setEmoji('🚫').setStyle(ButtonStyle.Secondary)
    )
  }
  row.addComponents(
    new ButtonBuilder().setCustomId(`post:my-delete:${postId}`).setLabel('Xoá bài').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  )

  const imgInfo = post.image_url ? '🖼️ Có ảnh' : '📄 Không ảnh'
  const changeImgChip = chip(interaction.client, 'post-edit-image')
  const hint = post.image_url
    ? `_Đổi ảnh? Bấm ${changeImgChip} → chọn bài #${postId} → chọn ảnh mới._`
    : `_Thêm ảnh? Bấm ${changeImgChip} → chọn bài #${postId} → chọn ảnh._`

  await interaction.update({
    content: `**Bài #${postId}** · [${post.status}] · ${imgInfo}\n📌 ${post.title}\n\n${hint}`,
    components: [row],
  })
}

// ============================================================
// Autocomplete
// ============================================================
async function handleAutocomplete(interaction) {
  const focused = interaction.options.getFocused(true)
  if (focused.name !== 'post_id') return

  const posts = dbPosts.getPostsByAuthor(interaction.guild.id, interaction.user.id, ['pending', 'approved'])
  const query = (focused.value || '').toString().toLowerCase()
  const choices = posts
    .filter(p => !query || p.title.toLowerCase().includes(query) || String(p.id).includes(query))
    .slice(0, 25)
    .map(p => ({
      name: `#${p.id} · [${p.status}] ${p.title.slice(0, 80)}`,
      value: p.id,
    }))
  await interaction.respond(choices).catch(() => {})
}

// ============================================================
// Main dispatcher
// ============================================================
module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand())  return handleSlashCommand(interaction, client)
      if (interaction.isModalSubmit())        return handleModalSubmit(interaction)
      if (interaction.isButton())             return handleButton(interaction)
      if (interaction.isStringSelectMenu())   return handleSelectMenu(interaction)
      if (interaction.isAutocomplete())       return handleAutocomplete(interaction)
    } catch (err) {
      console.error('[InteractionCreate]', err)
    }
  },
}
