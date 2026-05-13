// Spawn dashboard (always up) + bot (auto-restart on crash). Không phụ thuộc `ps`.
const { spawn } = require('child_process')
const path = require('path')

let shuttingDown = false
const children = []

function spawnChild(name, cwd, script, color, { restart = false } = {}) {
  const proc = spawn(process.execPath, [script], {
    cwd: path.join(__dirname, cwd),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
  const tag = `\x1b[${color}m[${name}]\x1b[0m`
  proc.stdout.on('data', (d) => process.stdout.write(`${tag} ${d}`))
  proc.stderr.on('data', (d) => process.stderr.write(`${tag} ${d}`))
  proc.on('exit', (code, signal) => {
    console.log(`${tag} exited (code=${code}, signal=${signal})`)
    children.splice(children.indexOf(proc), 1)
    if (shuttingDown) return
    if (restart) {
      console.log(`${tag} restarting in 5s...`)
      setTimeout(() => spawnChild(name, cwd, script, color, { restart }), 5000)
    } else {
      // Dashboard chết → cả container exit để Railway restart
      shutdown(code ?? 1)
    }
  })
  children.push(proc)
  return proc
}

function shutdown(code) {
  shuttingDown = true
  for (const p of children) {
    try { p.kill('SIGTERM') } catch (_) {}
  }
  setTimeout(() => process.exit(code), 5000).unref()
}

process.on('SIGTERM', () => shutdown(0))
process.on('SIGINT', () => shutdown(0))

spawnChild('web', 'dashboard', 'server.js', '32')
spawnChild('bot', 'bot', 'src/index.js', '34', { restart: true })
