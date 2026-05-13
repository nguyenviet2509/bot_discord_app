require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const { Client, GatewayIntentBits, Collection } = require('discord.js')
const path = require('path')
const fs = require('fs')
const { initDb } = require('../../shared/db')

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

client.once('ready', () => {
  console.log(`[Bot] ✅ Ready! Logged in as ${client.user.tag}`)
})

client.login(process.env.BOT_TOKEN)
