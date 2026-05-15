// Dashboard route: quan ly tier flair badge overrides + gui test preview
const express = require('express')
const db = require('../../shared/db')
const { LEVEL_TIERS } = require('../../bot/src/services/level-service')
const { isValidBadge, buildFlairNickname, getBadgeForTier } =
  require('../../bot/src/services/tier-flair-service')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

// GET: tra ve danh sach 10 tier kem badge hien tai (custom hoac default)
router.get('/', (req, res) => {
  const guildId = GUILD_ID()
  const overrides = db.getTierBadgeOverrides(guildId)
  const tiers = LEVEL_TIERS.map(t => ({
    min_level: t.minLevel,
    name: t.name,
    default_badge: t.badge,
    custom_badge: overrides.get(t.minLevel) || null,
    active_badge: overrides.get(t.minLevel) || t.badge,
  }))
  res.json({ tiers })
})

// PUT: set badge custom cho 1 tier
router.put('/:minLevel', (req, res) => {
  const minLevel = Number(req.params.minLevel)
  const { badge } = req.body
  const tierExists = LEVEL_TIERS.find(t => t.minLevel === minLevel)
  if (!tierExists) return res.status(400).json({ error: 'Tier khong hop le' })
  if (!isValidBadge(badge)) {
    return res.status(400).json({
      error: 'Emoji khong hop le. Chi chap nhan Unicode emoji (khong ho tro custom Discord emoji).',
    })
  }
  db.setTierBadge(GUILD_ID(), minLevel, badge)
  res.json({ success: true })
})

// DELETE: reset 1 tier ve default. /all -> reset het.
router.delete('/:minLevel', (req, res) => {
  const param = req.params.minLevel
  if (param === 'all') {
    db.resetTierBadge(GUILD_ID(), null)
    return res.json({ success: true })
  }
  const minLevel = Number(param)
  db.resetTierBadge(GUILD_ID(), minLevel)
  res.json({ success: true })
})

// POST /test: gui test message vao channel de preview nick voi flair
// Reuse Discord REST API (giong rewards/test)
router.post('/test', async (req, res) => {
  const { channel_id, min_level } = req.body
  if (!channel_id) return res.status(400).json({ error: 'channel_id la bat buoc' })
  if (!process.env.BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN chua cau hinh' })
  const guildId = GUILD_ID()
  const tier = LEVEL_TIERS.find(t => t.minLevel === Number(min_level)) || LEVEL_TIERS[0]
  const badge = getBadgeForTier(guildId, tier)
  const sampleNick = buildFlairNickname('TestUser', badge)

  const embed = {
    title: '🎖️ Tier Flair Preview',
    description:
      `Tier **${tier.name}** (lv ${tier.minLevel}+) sẽ hiển thị emoji **${badge}** kèm tên.\n\n` +
      `Nickname mẫu:\n\`\`\`${sampleNick}\`\`\``,
    color: tier.color,
    timestamp: new Date().toISOString(),
  }

  try {
    const r = await fetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${process.env.BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: '**[TEST Flair Preview]**', embeds: [embed] }),
    })
    if (!r.ok) {
      const errText = await r.text()
      return res.status(r.status).json({ error: `Discord API ${r.status}: ${errText.slice(0, 300)}` })
    }
    res.json({ success: true, sample_nick: sampleNick })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
