require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js')
const path = require('path')
const fs = require('fs')
const { initDb, getSettings, memberHasAccess, getExpiredBans, removeTempBan } = require('../../shared/db')

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

// Slash command handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return
  const command = client.commands.get(interaction.commandName)
  if (!command) return

  // Check quyen su dung bot
  if (interaction.guild) {
    const settings = getSettings(interaction.guild.id)
    const allowed = settings?.allowed_role_ids || []
    if (!memberHasAccess(interaction.member, allowed)) {
      return interaction.reply({
        content: '🚫 Bạn không có quyền sử dụng bot này. Liên hệ admin để được cấp role.',
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
})

// Auto-register slash commands voi Discord khi bot start
async function registerCommands() {
  const commandsData = []
  for (const [, cmd] of client.commands) commandsData.push(cmd.data.toJSON())
  if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
    console.warn('[Commands] CLIENT_ID hoac GUILD_ID chua duoc set → bo qua auto-register')
    return
  }
  try {
    const rest = new REST().setToken(process.env.BOT_TOKEN)
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commandsData }
    )
    console.log(`[Commands] ✅ Da register ${data.length} slash command(s) voi Discord`)
  } catch (err) {
    console.error('[Commands] ❌ Loi register:', err.message)
  }
}

client.once('ready', async () => {
  console.log(`[Bot] ✅ Ready! Logged in as ${client.user.tag}`)
  await registerCommands()
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
        console.log(`[TempBan] Da auto-unban user ${row.user_id} trong guild ${row.guild_id}`)
      } catch (err) {
        console.error('[TempBan] Loi auto-unban:', err.message)
      }
    }
  }, 60_000)
})

client.login(process.env.BOT_TOKEN)
