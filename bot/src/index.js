require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js')
const path = require('path')
const fs = require('fs')
const { initDb, getSettings, memberHasAccess, getExpiredBans, removeTempBan, logModAction, getDueScheduledMessages, markScheduledMessageSent } = require('../../shared/db')
const eventsDb = require('../../shared/db-events')
const { sendEventAnnouncement } = require('../../shared/send-event-announcement')
const { scanSilentMembers } = require('../../shared/scan-silent-members')
const { buildPayload } = require('../../shared/build-scheduled-payload')
const { buildLeaderboardText, mergeContentWithLeaderboard } = require('../../shared/build-leaderboard-text')
const { isDueByClock, isDueByInterval } = require('../../shared/schedule-time-helper')
const { scheduleDaily } = require('./utils/daily-cron')

initDb()
console.log('[DB] Database initialized')

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
})

// Load commands
client.commands = new Collection()
const commandsPath = path.join(__dirname, 'commands')
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsPath, file))
  if (cmd.data && cmd.execute) client.commands.set(cmd.data.name, cmd)
}

// Load events
const eventsPath = path.join(__dirname, 'events')
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file))
  client.on(event.name, (...args) => event.execute(...args, client))
}

// Load modules (sub-bot): quet bot/src/modules/<key>/, nap manifest + commands
const loadModules = require('./modules/_loader')
loadModules(client)

// Auto-register slash commands voi Discord khi bot start
async function registerCommands() {
  const commandsData = []
  for (const [, cmd] of client.commands) commandsData.push(cmd.data.toJSON())
  if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
    console.warn('[Commands] CLIENT_ID hoặc GUILD_ID chưa được set → bỏ qua auto-register')
    return
  }
  try {
    const rest = new REST().setToken(process.env.BOT_TOKEN)
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commandsData }
    )
    // Luu mapping name -> id de build chip mention `</name:id>`
    client.commandIds = Object.fromEntries(data.map(c => [c.name, c.id]))
    console.log(`[Commands] ✅ Đã register ${data.length} slash command(s) với Discord`)
  } catch (err) {
    console.error('[Commands] ❌ Lỗi register:', err.message)
  }
}

client.once('ready', async () => {
  console.log(`[Bot] ✅ Ready! Logged in as ${client.user.tag}`)
  await registerCommands()

  // Scheduled messages worker: check moi 60s, send neu da den han
  setInterval(async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const candidates = getDueScheduledMessages(nowSec)
    const due = candidates.filter(m => {
      if (m.schedule_time) return isDueByClock(m, nowSec)
      if (m.start_time) return isDueByInterval(m, nowSec)
      return true // legacy: SQL da loc
    })
    for (const msg of due) {
      try {
        const channel = client.channels.cache.get(msg.channel_id)
          || await client.channels.fetch(msg.channel_id).catch(() => null)
        if (!channel) {
          console.warn(`[SchedMsg] Channel ${msg.channel_id} not found, skip msg id=${msg.id}`)
          continue
        }
        let msgToSend = msg
        if (msg.kind === 'leaderboard') {
          const lbText = await buildLeaderboardText(msg.guild_id, { client })
          msgToSend = { ...msg, content: mergeContentWithLeaderboard(msg.content, lbText) }
        }
        const { payload, files } = buildPayload(msgToSend)
        await channel.send({ ...payload, files: files.map(f => ({ attachment: f.path, name: f.name })) })
        markScheduledMessageSent(msg.id)
        console.log(`[SchedMsg] Sent id=${msg.id} → channel ${msg.channel_id}`)
      } catch (err) {
        console.error(`[SchedMsg] Failed id=${msg.id}:`, err.message)
      }
    }
  }, 60_000)

  // Event announcements worker: gui auto khi start_at toi
  setInterval(async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    let due = []
    try { due = eventsDb.getDueEventAnnouncements(nowSec) } catch (err) {
      console.error('[Events] getDue failed:', err.message); return
    }
    for (const ev of due) {
      try {
        const r = await sendEventAnnouncement(ev)
        if (r.ok) {
          eventsDb.markAnnouncementSent(ev.id, ev.guild_id)
          console.log(`[Events] Auto-sent announcement id=${ev.id} → channel ${ev.announce_channel_id}`)
        } else {
          console.warn(`[Events] Auto-send id=${ev.id} fail: ${r.error}`)
        }
      } catch (err) {
        console.error(`[Events] Auto-send id=${ev.id} error:`, err.message)
      }
    }
  }, 60_000)

  // Cron: 00:00 moi ngay → quet silent members cho tat ca guild bot dang join
  scheduleDaily('scan-silent-members', async () => {
    for (const [guildId] of client.guilds.cache) {
      try {
        const result = await scanSilentMembers(guildId)
        console.log(`[Cron] Silent scan guild ${guildId}: ${result.total} members`)
      } catch (err) {
        console.error(`[Cron] Silent scan guild ${guildId} failed:`, err.message)
      }
    }
  })
  // Watcher: check va auto-unban moi 60s
  setInterval(async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const expired = getExpiredBans(nowSec)
    for (const row of expired) {
      try {
        const guild = client.guilds.cache.get(row.guild_id)
        if (!guild) { removeTempBan(row.guild_id, row.user_id); continue }
        await guild.members.unban(row.user_id, 'Tự động unban (hết hạn)').catch(() => {})
        removeTempBan(row.guild_id, row.user_id)
        logModAction({
          guild_id: row.guild_id,
          action_type: 'unban',
          user_id: row.user_id,
          user_tag: null, user_avatar: null,
          moderator_id: client.user?.id || null,
          moderator_tag: 'Bot (auto-unban)',
          reason: 'Hết hạn ban',
        })
        console.log(`[TempBan] Đã auto-unban user ${row.user_id} trong guild ${row.guild_id}`)
      } catch (err) {
        console.error('[TempBan] Lỗi auto-unban:', err.message)
      }
    }
  }, 60_000)
})

client.login(process.env.BOT_TOKEN)
