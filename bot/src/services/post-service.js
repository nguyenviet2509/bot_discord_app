// Business logic cho post approval flow
const db = require('../../../shared/db')
const dbPosts = require('../../../shared/db-posts')
const { buildPostEmbed, buildReviewButtons } = require('../utils/post-embed')

// Validate guild settings co du config khong
function validateSettings(guildId) {
  const s = db.getSettings(guildId)
  if (!s) return { ok: false, reason: 'Bot chưa được cấu hình. Admin chạy `/post-setup channels` trước.' }
  if (!s.post_entry_channel_id) return { ok: false, reason: 'Chưa set entry channel.' }
  if (!s.review_channel_id) return { ok: false, reason: 'Chưa set review channel.' }
  if (!s.public_forum_id) return { ok: false, reason: 'Chưa set public forum.' }
  return { ok: true, settings: s }
}

// Check member co quyen admin duyet bai khong
function isPostAdmin(member, settings) {
  const adminRoles = settings.post_admin_role_ids || []
  if (adminRoles.length === 0) return false
  return adminRoles.some(rid => member.roles.cache.has(rid))
}

// Tao bai dang moi (status=pending), post vao #review, DM author
async function createPendingPost(interaction, fields) {
  const guild = interaction.guild
  const member = interaction.member
  const { ok, settings, reason } = validateSettings(guild.id)
  if (!ok) return { error: reason }

  const reviewCh = await guild.channels.fetch(settings.review_channel_id).catch(() => null)
  if (!reviewCh) return { error: 'Không tìm thấy review channel.' }

  const postId = dbPosts.createPost({
    guild_id: guild.id,
    author_id: member.id,
    author_tag: member.displayName || member.user.username,
    author_avatar: member.user.displayAvatarURL({ size: 128 }),
    title: fields.title,
    content: fields.content,
    price: fields.price,
    contact: fields.contact,
    image_url: fields.image_url || null,
  })

  const post = dbPosts.getPost(postId)
  const embed = buildPostEmbed(post, 'pending')
  const buttons = buildReviewButtons(postId)
  // Mention admin roles de Discord notify thay vi DM tung admin (option A)
  const adminMentions = (settings.post_admin_role_ids || []).map(id => `<@&${id}>`).join(' ')
  const reviewMsg = await reviewCh.send({
    content: adminMentions ? `${adminMentions} có bài mới cần duyệt:` : undefined,
    embeds: [embed],
    components: [buttons],
    allowedMentions: { roles: settings.post_admin_role_ids || [] },
  })
  dbPosts.setPostReviewMessage(postId, reviewMsg.id)

  // DM author (best-effort)
  member.send(`✅ Bài đăng **#${postId}** "${post.title}" đã gửi duyệt. Bạn sẽ nhận DM khi có kết quả.`).catch(() => {})

  return { postId, messageUrl: reviewMsg.url }
}

// Admin duyet bai: tao thread trong forum, update DB, edit review msg, DM author
async function approvePost(interaction, postId) {
  const guild = interaction.guild
  const { ok, settings, reason } = validateSettings(guild.id)
  if (!ok) return { error: reason }
  if (!isPostAdmin(interaction.member, settings)) return { error: 'Bạn không có quyền duyệt bài.' }

  const post = dbPosts.getPost(postId)
  if (!post) return { error: 'Bài không tồn tại.' }
  if (post.status !== 'pending') return { error: `Bài đã được xử lý (status: ${post.status}).` }

  const forum = await guild.channels.fetch(settings.public_forum_id).catch(() => null)
  if (!forum) return { error: 'Forum public không tồn tại.' }

  // Build embed approved (dung audit fields cap nhat)
  const approvedPost = { ...post, status: 'approved', approver_tag: interaction.member.displayName, reviewed_at: Math.floor(Date.now() / 1000) }
  const embed = buildPostEmbed(approvedPost, 'approved')

  let thread
  try {
    thread = await forum.threads.create({
      name: post.title.slice(0, 100),
      message: { embeds: [embed] },
    })
  } catch (err) {
    return { error: `Không tạo được thread trong forum: ${err.message}` }
  }

  dbPosts.updatePostStatus(postId, {
    status: 'approved',
    approver_id: interaction.member.id,
    approver_tag: interaction.member.displayName,
    public_thread_id: thread.id,
    reviewed_at: Math.floor(Date.now() / 1000),
  })

  // Edit review message: bo button, update embed
  try {
    await interaction.message.edit({ embeds: [embed], components: [] })
  } catch (_) {}

  // DM author
  const author = await guild.members.fetch(post.author_id).catch(() => null)
  if (author) {
    author.send(`✅ Bài **#${postId}** "${post.title}" đã được duyệt!\nXem: ${thread.url}`).catch(() => {})
  }

  return { thread }
}

// Admin tu choi bai voi ly do
async function rejectPost(interaction, postId, reasonText) {
  const guild = interaction.guild
  const { ok, settings, reason: validErr } = validateSettings(guild.id)
  if (!ok) return { error: validErr }
  if (!isPostAdmin(interaction.member, settings)) return { error: 'Bạn không có quyền duyệt bài.' }

  const post = dbPosts.getPost(postId)
  if (!post) return { error: 'Bài không tồn tại.' }
  if (post.status !== 'pending') return { error: `Bài đã được xử lý (status: ${post.status}).` }

  dbPosts.updatePostStatus(postId, {
    status: 'rejected',
    approver_id: interaction.member.id,
    approver_tag: interaction.member.displayName,
    reject_reason: reasonText,
    reviewed_at: Math.floor(Date.now() / 1000),
  })

  const updated = dbPosts.getPost(postId)
  const embed = buildPostEmbed(updated, 'rejected')

  try {
    await interaction.message.edit({ embeds: [embed], components: [] })
  } catch (_) {}

  const author = await guild.members.fetch(post.author_id).catch(() => null)
  if (author) {
    author.send(`❌ Bài **#${postId}** "${post.title}" bị từ chối.\n**Lý do:** ${reasonText}`).catch(() => {})
  }

  return { ok: true }
}

// Edit bai: neu da approved -> xoa thread cu, repost vao review; neu pending -> edit msg review tai cho
async function editPost(interaction, postId, fields) {
  const guild = interaction.guild
  const { ok, settings, reason } = validateSettings(guild.id)
  if (!ok) return { error: reason }

  const post = dbPosts.getPost(postId)
  if (!post) return { error: 'Bài không tồn tại.' }
  if (post.author_id !== interaction.member.id) return { error: 'Bạn không phải chủ bài.' }
  if (post.status === 'deleted' || post.status === 'rejected') {
    return { error: 'Bài đã bị xoá hoặc từ chối, không thể sửa. Hãy tạo bài mới.' }
  }

  dbPosts.updatePostContent(postId, fields)

  const reviewCh = await guild.channels.fetch(settings.review_channel_id).catch(() => null)
  if (!reviewCh) return { error: 'Không tìm thấy review channel.' }

  // Neu dang approved -> xoa thread public, reset ve pending, repost vao review
  if (post.status === 'approved') {
    if (post.public_thread_id) {
      const thread = await guild.channels.fetch(post.public_thread_id).catch(() => null)
      if (thread) await thread.delete('Bài được sửa, cần re-review').catch(() => {})
    }
    dbPosts.setPostStatusPending(postId)
    const updated = dbPosts.getPost(postId)
    const embed = buildPostEmbed(updated, 'pending')
    const buttons = buildReviewButtons(postId)
    const adminMentions = (settings.post_admin_role_ids || []).map(id => `<@&${id}>`).join(' ')
    const msg = await reviewCh.send({
      content: adminMentions ? `${adminMentions} có bài sửa cần duyệt lại:` : undefined,
      embeds: [embed],
      components: [buttons],
      allowedMentions: { roles: settings.post_admin_role_ids || [] },
    })
    dbPosts.setPostReviewMessage(postId, msg.id)
    return { restatus: 'pending', messageUrl: msg.url }
  }

  // Pending -> chi edit msg cu tai cho
  if (post.review_message_id) {
    const oldMsg = await reviewCh.messages.fetch(post.review_message_id).catch(() => null)
    if (oldMsg) {
      const updated = dbPosts.getPost(postId)
      const embed = buildPostEmbed(updated, 'pending')
      const buttons = buildReviewButtons(postId)
      await oldMsg.edit({ embeds: [embed], components: [buttons] }).catch(() => {})
    }
  }
  return { restatus: 'pending' }
}

// Xoa bai: xoa thread + review msg, mark status=deleted
async function deletePost(interaction, postId) {
  const guild = interaction.guild
  const post = dbPosts.getPost(postId)
  if (!post) return { error: 'Bài không tồn tại.' }

  const isOwner = post.author_id === interaction.member.id
  const isAdmin = interaction.member.permissions.has('ManageMessages')
  if (!isOwner && !isAdmin) return { error: 'Bạn không có quyền xoá bài này.' }
  if (post.status === 'deleted') return { error: 'Bài đã bị xoá.' }

  // Xoa thread public neu co
  if (post.public_thread_id) {
    const thread = await guild.channels.fetch(post.public_thread_id).catch(() => null)
    if (thread) await thread.delete('Bài bị xoá').catch(() => {})
  }
  // Xoa review msg neu co
  const settings = db.getSettings(guild.id)
  if (post.review_message_id && settings?.review_channel_id) {
    const reviewCh = await guild.channels.fetch(settings.review_channel_id).catch(() => null)
    if (reviewCh) {
      const msg = await reviewCh.messages.fetch(post.review_message_id).catch(() => null)
      if (msg) await msg.delete().catch(() => {})
    }
  }

  dbPosts.updatePostStatus(postId, { status: 'deleted', reviewed_at: Math.floor(Date.now() / 1000) })
  return { ok: true }
}

module.exports = {
  validateSettings,
  isPostAdmin,
  createPendingPost,
  approvePost,
  rejectPost,
  editPost,
  deletePost,
}
