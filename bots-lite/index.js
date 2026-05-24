// Manager cho cac LiteClient. Singleton — giu Map<id, LiteClient>.
// Lazy start: chi login khi caller goi start(id).
// Khong tu dong restore tu DB khi process boot.

const path = require('path')
const fs = require('fs')
const dbManaged = require('../shared/db-managed-bots')
const { decrypt } = require('./token-crypto')
const { LiteClient } = require('./lite-client')

const USERNAME_COOLDOWN_MS = 30 * 60 * 1000 // 30 phut — safe buffer cho Discord ~2/h

const clients = new Map() // id → LiteClient

function isRunning(id) {
  return clients.get(id)?.isRunning() === true
}

function canChangeUsername(bot) {
  if (!bot?.last_username_change) return true
  return Date.now() - bot.last_username_change > USERNAME_COOLDOWN_MS
}

function avatarUrlToAbsolute(avatarUrl) {
  if (!avatarUrl) return null
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl
  // Local upload URL like /uploads/foo.png — convert to file path
  if (avatarUrl.startsWith('/uploads/')) {
    const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..')
    const filePath = path.join(DATA_DIR, avatarUrl)
    if (fs.existsSync(filePath)) return filePath
  }
  return avatarUrl
}

async function start(id) {
  if (clients.has(id)) {
    if (clients.get(id).isRunning()) return { status: 'running' }
    clients.delete(id)
  }
  const bot = dbManaged.getBotFull(id)
  if (!bot) throw new Error('Bot khong ton tai')

  let token
  try {
    token = decrypt(bot.discord_token, bot.token_iv)
  } catch (err) {
    dbManaged.updateStatus(id, 'error', `Giai ma token that bai: ${err.message}`)
    throw new Error('Khong giai ma duoc token (kiem tra BOT_TOKEN_ENCRYPTION_KEY)')
  }

  const client = new LiteClient({
    id,
    token,
    displayName: bot.display_name,
    avatarUrl: avatarUrlToAbsolute(bot.avatar_url),
    presenceStatus: bot.presence_status,
    activityType: bot.activity_type,
    activityText: bot.activity_text,
    onError: (err) => {
      console.error(`[bots-lite#${id}]`, err.message)
      dbManaged.updateStatus(id, 'error', err.message.slice(0, 500))
    },
  })

  try {
    await client.start()
    clients.set(id, client)
    dbManaged.updateStatus(id, 'running', null)
    return { status: 'running' }
  } catch (err) {
    dbManaged.updateStatus(id, 'error', err.message.slice(0, 500))
    throw err
  }
}

async function stop(id) {
  const client = clients.get(id)
  if (client) {
    await client.stop()
    clients.delete(id)
  }
  dbManaged.updateStatus(id, 'stopped', null)
  return { status: 'stopped' }
}

// Apply runtime changes neu bot dang chay. Tra ve { usernameChanged }
async function applyRuntimeChanges(id, patch) {
  const client = clients.get(id)
  if (!client || !client.isRunning()) {
    return { usernameChanged: false, applied: false }
  }
  const bot = dbManaged.getBotFull(id)
  if (!bot) return { usernameChanged: false, applied: false }

  let usernameChanged = false
  if (patch.display_name !== undefined || patch.avatar_url !== undefined) {
    // Rate-limit guard cho username
    if (patch.display_name !== undefined && patch.display_name !== bot.display_name && !canChangeUsername(bot)) {
      throw new Error('Khong the doi ten ngay — vui long doi 30 phut sau lan doi truoc')
    }
    const result = await client.applyIdentityRuntime({
      displayName: patch.display_name,
      avatarUrl: patch.avatar_url ? avatarUrlToAbsolute(patch.avatar_url) : undefined,
    })
    usernameChanged = result.usernameChanged
  }
  if (patch.presence_status !== undefined || patch.activity_type !== undefined || patch.activity_text !== undefined) {
    client.applyPresenceRuntime({
      presenceStatus: patch.presence_status,
      activityType: patch.activity_type,
      activityText: patch.activity_text,
    })
  }
  return { usernameChanged, applied: true }
}

async function stopAll() {
  const ids = Array.from(clients.keys())
  await Promise.all(ids.map((id) => stop(id).catch(() => {})))
}

function getStatus(id) {
  return isRunning(id) ? 'running' : 'stopped'
}

function listRunning() {
  return Array.from(clients.keys())
}

module.exports = {
  start,
  stop,
  stopAll,
  applyRuntimeChanges,
  getStatus,
  listRunning,
  isRunning,
  canChangeUsername,
  USERNAME_COOLDOWN_MS,
}
