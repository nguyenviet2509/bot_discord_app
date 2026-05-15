const express = require('express')
const db = require('../../shared/db')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

const defaultSettings = () => ({
  guild_id: GUILD_ID(),
  xp_min: 15,
  xp_max: 25,
  cooldown_seconds: 60,
  level_up_channel_id: process.env.LEVELUP_CHANNEL_ID || null,
  level_up_reply_channel_id: null,
  allowed_role_ids: [],
})

router.get('/', (req, res) => {
  const settings = db.getSettings(GUILD_ID()) || defaultSettings()
  res.json(settings)
})

router.put('/', (req, res) => {
  const { xp_min, xp_max, cooldown_seconds, level_up_channel_id, level_up_reply_channel_id, allowed_role_ids } = req.body

  if (xp_min !== undefined && xp_max !== undefined && Number(xp_min) >= Number(xp_max)) {
    return res.status(400).json({ error: 'xp_min phải nhỏ hơn xp_max' })
  }
  if (cooldown_seconds !== undefined && Number(cooldown_seconds) < 5) {
    return res.status(400).json({ error: 'cooldown_seconds tối thiểu là 5 giây' })
  }
  if (allowed_role_ids !== undefined && !Array.isArray(allowed_role_ids)) {
    return res.status(400).json({ error: 'allowed_role_ids phải là mảng' })
  }

  const current = db.getSettings(GUILD_ID()) || defaultSettings()
  db.upsertSettings({
    guild_id: GUILD_ID(),
    xp_min: xp_min !== undefined ? Number(xp_min) : current.xp_min,
    xp_max: xp_max !== undefined ? Number(xp_max) : current.xp_max,
    cooldown_seconds: cooldown_seconds !== undefined ? Number(cooldown_seconds) : current.cooldown_seconds,
    level_up_channel_id: level_up_channel_id !== undefined ? level_up_channel_id : current.level_up_channel_id,
    level_up_reply_channel_id: level_up_reply_channel_id !== undefined ? level_up_reply_channel_id : current.level_up_reply_channel_id,
    allowed_role_ids: allowed_role_ids !== undefined ? allowed_role_ids : current.allowed_role_ids,
  })
  res.json({ success: true })
})

module.exports = router
