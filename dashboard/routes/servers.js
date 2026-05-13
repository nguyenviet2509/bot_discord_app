const https = require('https')
const express = require('express')

const router = express.Router()

function fetchBotGuilds() {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'discord.com',
        path: '/api/v10/users/@me/guilds',
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

function fetchGuildDetail(guildId) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'discord.com',
        path: `/api/v10/guilds/${guildId}?with_counts=true`,
        method: 'GET',
        headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch (_) { resolve(null) }
        })
      }
    )
    req.on('error', () => resolve(null))
    req.end()
  })
}

router.get('/', async (req, res) => {
  const guilds = await fetchBotGuilds()
  if (!Array.isArray(guilds)) {
    return res.status(502).json({ error: 'Cannot fetch servers from Discord API' })
  }

  // Fetch member counts in parallel (max 10 concurrent)
  const results = await Promise.all(
    guilds.map(async (g) => {
      const detail = await fetchGuildDetail(g.id)
      return {
        id: g.id,
        name: g.name,
        icon: g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
          : null,
        member_count: detail?.approximate_member_count || null,
        online_count: detail?.approximate_presence_count || null,
        owner: g.owner || false,
      }
    })
  )

  res.json(results)
})

module.exports = router
