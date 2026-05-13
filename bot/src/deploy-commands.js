require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const { REST, Routes } = require('discord.js')
const path = require('path')
const fs = require('fs')

const commands = []
const commandsPath = path.join(__dirname, 'commands')
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsPath, file))
  if (cmd.data) commands.push(cmd.data.toJSON())
}

const rest = new REST().setToken(process.env.BOT_TOKEN)

;(async () => {
  try {
    console.log(`[Deploy] Registering ${commands.length} slash command(s) for guild ${process.env.GUILD_ID}...`)
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    )
    console.log(`[Deploy] ✅ Successfully registered ${data.length} command(s).`)
  } catch (err) {
    console.error('[Deploy] ❌ Error:', err)
  }
})()
