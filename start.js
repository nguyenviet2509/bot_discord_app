// Spawn bot + dashboard trong cùng container. Khi 1 process exit → kill cái còn lại
// → container exit → Railway tự restart. Không phụ thuộc `ps` hay `concurrently`.
const { spawn } = require('child_process')
const path = require('path')

const procs = []
let shuttingDown = false

function run(name, cwd, color) {
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: path.join(__dirname, cwd),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
  const tag = `\x1b[${color}m[${name}]\x1b[0m`
  child.stdout.on('data', (d) => process.stdout.write(`${tag} ${d}`))
  child.stderr.on('data', (d) => process.stderr.write(`${tag} ${d}`))
  child.on('exit', (code, signal) => {
    console.log(`${tag} exited (code=${code}, signal=${signal})`)
    if (!shuttingDown) shutdown(code ?? 1)
  })
  procs.push(child)
  return child
}

function shutdown(code) {
  shuttingDown = true
  for (const p of procs) {
    if (!p.killed) {
      try { p.kill('SIGTERM') } catch (_) {}
    }
  }
  setTimeout(() => process.exit(code), 5000).unref()
}

process.on('SIGTERM', () => shutdown(0))
process.on('SIGINT', () => shutdown(0))

// Dashboard chạy server.js, không phải src/index.js → spawn riêng
const botProc = run('bot', 'bot', '34')
const dashProc = spawn(process.execPath, ['server.js'], {
  cwd: path.join(__dirname, 'dashboard'),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
})
const dashTag = '\x1b[32m[web]\x1b[0m'
dashProc.stdout.on('data', (d) => process.stdout.write(`${dashTag} ${d}`))
dashProc.stderr.on('data', (d) => process.stderr.write(`${dashTag} ${d}`))
dashProc.on('exit', (code, signal) => {
  console.log(`${dashTag} exited (code=${code}, signal=${signal})`)
  if (!shuttingDown) shutdown(code ?? 1)
})
procs.push(dashProc)
