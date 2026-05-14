const express = require('express')
const db = require('../../shared/db')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

router.get('/', (req, res) => {
  res.json(db.getLevelUpTemplate(GUILD_ID()))
})

router.put('/', (req, res) => {
  const {
    title, description, milestone_description,
    show_tier_field, show_xp_field, show_progress_field,
    show_role_reward, show_badge_reward, show_badge_image,
    show_avatar, mention_user, color_mode, custom_color,
  } = req.body

  if (!title || !description || !milestone_description) {
    return res.status(400).json({ error: 'title, description và milestone_description là bắt buộc' })
  }
  if (color_mode && !['tier', 'custom'].includes(color_mode)) {
    return res.status(400).json({ error: 'color_mode phải là tier hoặc custom' })
  }
  if (custom_color && !/^#[0-9a-fA-F]{6}$/.test(custom_color)) {
    return res.status(400).json({ error: 'custom_color phải là hex 6 ký tự, vd: #6366f1' })
  }

  // Booleans → 0/1
  const b = (v) => (v ? 1 : 0)

  db.upsertLevelUpTemplate({
    guild_id: GUILD_ID(),
    title,
    description,
    milestone_description,
    show_tier_field: b(show_tier_field),
    show_xp_field: b(show_xp_field),
    show_progress_field: b(show_progress_field),
    show_role_reward: b(show_role_reward),
    show_badge_reward: b(show_badge_reward),
    show_badge_image: b(show_badge_image),
    show_avatar: b(show_avatar),
    mention_user: b(mention_user),
    color_mode: color_mode || 'tier',
    custom_color: custom_color || '#6366f1',
  })
  res.json({ success: true })
})

// Gui thong bao test toi 1 channel Discord (dung Discord REST API truc tiep)
router.post('/test', async (req, res) => {
  const { channel_id, level, template } = req.body
  if (!channel_id) return res.status(400).json({ error: 'channel_id la bat buoc' })
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chua duoc cau hinh' })

  const tpl = template || db.getLevelUpTemplate(GUILD_ID())
  const lvl = Number(level) || 10
  const guildId = GUILD_ID()
  const rewards = db.getRewards(guildId)
  const rewardAtLevel = rewards.filter(r => r.level_required === lvl)
  const roleReward = rewardAtLevel.find(r => r.type === 'role')
  const badgeReward = rewardAtLevel.find(r => r.type === 'badge')
  const isMilestone = rewardAtLevel.length > 0
  const fakeXp = lvl * 1000

  // Ten reward de chen vao {reward}
  const rewardName = badgeReward?.badge_name || (roleReward ? `Role ${roleReward.role_id}` : '')

  const fill = (str) => (str || '')
    .replace(/\{user\}/g, 'TestUser')
    .replace(/\{level\}/g, String(lvl))
    .replace(/\{xp\}/g, fakeXp.toLocaleString())
    .replace(/\{reward\}/g, rewardName)
    .replace(/\{tier(_badge)?\}/g, '')

  const color = tpl.color_mode === 'custom'
    ? parseInt((tpl.custom_color || '#6366f1').replace('#', ''), 16)
    : 0x6366f1

  const embed = {
    title: fill(tpl.title),
    description: fill(isMilestone ? tpl.milestone_description : tpl.description),
    color,
    timestamp: new Date().toISOString(),
  }

  if (tpl.show_avatar) {
    // Avatar placeholder Discord default
    embed.thumbnail = { url: 'https://cdn.discordapp.com/embed/avatars/0.png' }
  }

  const fields = []
  if (tpl.show_tier_field && rewardName) fields.push({ name: 'Phan thuong', value: rewardName, inline: true })
  if (tpl.show_xp_field) fields.push({ name: 'Tong XP', value: `${fakeXp.toLocaleString()} XP`, inline: true })
  if (tpl.show_progress_field) fields.push({ name: 'Tien do', value: '[█████░░░░░] 50%', inline: true })

  if (tpl.show_role_reward) {
    const roleIdToShow = roleReward?.role_id || badgeReward?.role_id
    if (roleIdToShow) fields.push({ name: '🏅 Nhan duoc role', value: `<@&${roleIdToShow}>`, inline: false })
  }

  if (tpl.show_badge_reward && badgeReward) {
    fields.push({ name: '🖼️ Huy hieu moi', value: badgeReward.badge_name || 'Badge', inline: false })
    if (tpl.show_badge_image && badgeReward.badge_url) {
      const base = process.env.BASE_URL || ''
      if (base) embed.image = { url: `${base}${badgeReward.badge_url}` }
    }
  }

  if (fields.length) embed.fields = fields

  const body = {
    content: tpl.mention_user ? '**[TEST]** @TestUser' : '**[TEST]**',
    embeds: [embed],
  }

  try {
    const r = await fetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${process.env.BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const errText = await r.text()
      return res.status(r.status).json({ error: `Discord API ${r.status}: ${errText.slice(0, 300)}` })
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
