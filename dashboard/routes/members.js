const https = require('https')
const express = require('express')
const db = require('../../shared/db')

const router = express.Router()
const GUILD_ID = () => process.env.GUILD_ID

function fetchDiscordMembers(guildId) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'discord.com',
        path: `/api/v10/guilds/${guildId}/members?limit=1000`,
        method: 'GET',
        headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch (_) { resolve([]) }
        })
      }
    )
    req.on('error', () => resolve([]))
    req.end()
  })
}

router.get('/', async (req, res) => {
  const guildId = GUILD_ID()
  const users = db.getAllUsers(guildId)

  // Always refresh username + nickname from Discord API for latest display names
  const members = await fetchDiscordMembers(guildId)
  if (Array.isArray(members)) {
    for (const member of members) {
      const discordUser = member.user
      if (!discordUser) continue
      const dbUser = users.find((u) => u.id === discordUser.id)
      if (!dbUser) continue
      // Update in-memory for response
      dbUser.username = discordUser.username
      dbUser.avatar = discordUser.avatar
      dbUser.nickname = member.nick || null
      dbUser.global_name = discordUser.global_name || null
      // Persist to DB
      db.upsertUser({
        id: discordUser.id,
        guild_id: guildId,
        xp: dbUser.xp,
        level: dbUser.level,
        last_message_at: dbUser.last_message_at,
        username: discordUser.username,
        avatar: discordUser.avatar,
        nickname: member.nick || null,
        global_name: discordUser.global_name || null,
      })
    }
  }

  res.json(users)
})

router.delete('/:id/xp', (req, res) => {
  const user = db.getUser(req.params.id, GUILD_ID())
  if (!user) return res.status(404).json({ error: 'Khong tim thay thanh vien' })
  db.resetUserXp(req.params.id, GUILD_ID())
  res.json({ success: true })
})

router.delete('/:id', (req, res) => {
  const result = db.deleteUser(req.params.id, GUILD_ID())
  if (!result.changes) return res.status(404).json({ error: 'Khong tim thay thanh vien' })
  res.json({ success: true })
})

module.exports = router
