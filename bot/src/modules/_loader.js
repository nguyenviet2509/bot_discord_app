// Module loader - quet bot/src/modules/<key>/ va nap manifest + commands + register.
// Goi tu bot/src/index.js sau khi nap core commands/events.
//
// Yeu cau:
//   - Moi module co manifest.js voi {key, name, description, defaultEnabled, commands}
//   - Commands trong modules/<key>/commands/*.js (optional)
//   - register.js (optional): module.exports = function(client, ctx) {...}
//   - ctx = { manifest, buttonHandlers: array de push handler }
// Sau khi load:
//   - client.commands chua ca core va module commands (module cmd co cmd._module = key)
//   - client._modules: Map<key, manifest>
//   - client._moduleButtonHandlers: array<fn(interaction): Promise<boolean>>

const fs = require('fs')
const path = require('path')

function loadModules(client) {
  const modulesRoot = __dirname
  client._modules = new Map()
  client._moduleButtonHandlers = []
  client._moduleMessageHandlers = []

  if (!fs.existsSync(modulesRoot)) {
    console.log('[Modules] modules/ folder khong ton tai, bo qua')
    return
  }

  const entries = fs.readdirSync(modulesRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))

  for (const dirent of entries) {
    const moduleDir = path.join(modulesRoot, dirent.name)
    const manifestPath = path.join(moduleDir, 'manifest.js')
    if (!fs.existsSync(manifestPath)) {
      console.warn(`[Modules] ${dirent.name}/manifest.js khong ton tai, bo qua module nay`)
      continue
    }

    let manifest
    try {
      manifest = require(manifestPath)
    } catch (err) {
      console.error(`[Modules] Loi load manifest ${dirent.name}:`, err.message)
      continue
    }

    if (!manifest.key || !manifest.name) {
      console.error(`[Modules] ${dirent.name}/manifest.js thieu key hoac name, bo qua`)
      continue
    }
    if (client._modules.has(manifest.key)) {
      throw new Error(`[Modules] Trung module key: ${manifest.key}`)
    }

    // Nap commands
    const cmdDir = path.join(moduleDir, 'commands')
    let loadedCmds = []
    if (fs.existsSync(cmdDir)) {
      for (const f of fs.readdirSync(cmdDir).filter(x => x.endsWith('.js'))) {
        const cmd = require(path.join(cmdDir, f))
        if (!cmd.data || !cmd.execute) {
          console.warn(`[Modules] ${manifest.key}/commands/${f} thieu data/execute, bo qua`)
          continue
        }
        const cmdName = cmd.data.name
        if (client.commands.has(cmdName)) {
          throw new Error(`[Modules] Command '${cmdName}' (module ${manifest.key}) trung voi core/module khac`)
        }
        cmd._module = manifest.key
        client.commands.set(cmdName, cmd)
        loadedCmds.push(cmdName)
      }
    }

    // Goi register.js neu co
    const regPath = path.join(moduleDir, 'register.js')
    if (fs.existsSync(regPath)) {
      const register = require(regPath)
      try {
        register(client, {
          manifest,
          buttonHandlers: client._moduleButtonHandlers,
          messageHandlers: client._moduleMessageHandlers,
        })
      } catch (err) {
        console.error(`[Modules] Loi register module ${manifest.key}:`, err)
      }
    }

    client._modules.set(manifest.key, manifest)
    console.log(`[Modules] ✓ Loaded "${manifest.name}" (${manifest.key}) - commands: ${loadedCmds.join(', ') || '(none)'}`)
  }

  console.log(`[Modules] Total: ${client._modules.size} module(s), ${client._moduleButtonHandlers.length} button handler(s), ${client._moduleMessageHandlers.length} message handler(s)`)
}

module.exports = loadModules
