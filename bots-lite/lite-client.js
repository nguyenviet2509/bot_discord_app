// LiteClient: 1 Discord Client toi gian cho bot phu "vo tri".
// Khong dang ky command, khong listen event nghiep vu — chi hien dien voi
// custom name + avatar + presence/activity.
//
// Quan trong:
//   - Username rate limit: Discord ~2 lan/h. Caller phai check last_username_change
//     truoc khi goi applyIdentity({displayName}).
//   - ActivityType.Custom co the khong hien thi dung voi bot — neu user chon Custom
//     ma khong thay status text → fallback de cuoi cung la khong gan activity.

const { Client, GatewayIntentBits, ActivityType } = require('discord.js')

const ACTIVITY_TYPE_MAP = {
  Playing: ActivityType.Playing,
  Watching: ActivityType.Watching,
  Listening: ActivityType.Listening,
  Competing: ActivityType.Competing,
  Custom: ActivityType.Custom,
}

const PRESENCE_STATUS_VALUES = ['online', 'idle', 'dnd', 'invisible']

class LiteClient {
  constructor({ id, token, displayName, avatarUrl, presenceStatus, activityType, activityText, onError, onReady }) {
    this.id = id
    this.token = token
    this.displayName = displayName
    this.avatarUrl = avatarUrl
    this.presenceStatus = PRESENCE_STATUS_VALUES.includes(presenceStatus) ? presenceStatus : 'online'
    this.activityType = activityType || 'Playing'
    this.activityText = activityText || null
    this.onError = onError || (() => {})
    this.onReady = onReady || (() => {})
    this.client = null
    this.ready = false
  }

  async start() {
    if (this.client) return
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] })
    this.client.on('error', (err) => this.onError(err))
    this.client.on('shardError', (err) => this.onError(err))

    const readyPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Bot login timeout sau 15s')), 15000)
      this.client.once('clientReady', async () => {
        clearTimeout(timer)
        try {
          await this._applyIdentityOnReady()
          this._applyPresence()
          this.ready = true
          this.onReady()
          resolve()
        } catch (err) {
          reject(err)
        }
      })
    })

    try {
      await this.client.login(this.token)
      await readyPromise
    } catch (err) {
      // Cleanup neu login fail
      try { this.client.destroy() } catch (_) {}
      this.client = null
      this.ready = false
      throw err
    }
  }

  async stop() {
    if (!this.client) return
    try { this.client.destroy() } catch (_) {}
    this.client = null
    this.ready = false
  }

  isRunning() {
    return this.ready && !!this.client
  }

  // Goi luc on ready: chi setUsername/setAvatar khi gia tri muc tieu khac hien tai
  async _applyIdentityOnReady() {
    if (!this.client?.user) return
    const user = this.client.user
    let usernameChanged = false
    if (this.displayName && user.username !== this.displayName) {
      try {
        await user.setUsername(this.displayName)
        usernameChanged = true
      } catch (err) {
        // Rate limit hoac perm error — log nhung khong throw, bot van chay
        this.onError(new Error(`setUsername fail: ${err.message}`))
      }
    }
    if (this.avatarUrl) {
      try {
        // discord.js chap nhan URL string truc tiep
        await user.setAvatar(this.avatarUrl)
      } catch (err) {
        this.onError(new Error(`setAvatar fail: ${err.message}`))
      }
    }
    return { usernameChanged }
  }

  // Apply identity changes runtime (sau khi da ready)
  async applyIdentityRuntime({ displayName, avatarUrl }) {
    if (!this.isRunning()) return { usernameChanged: false }
    const user = this.client.user
    let usernameChanged = false
    if (displayName !== undefined && displayName !== null && user.username !== displayName) {
      await user.setUsername(displayName)
      this.displayName = displayName
      usernameChanged = true
    }
    if (avatarUrl !== undefined && avatarUrl !== null) {
      await user.setAvatar(avatarUrl)
      this.avatarUrl = avatarUrl
    }
    return { usernameChanged }
  }

  _applyPresence() {
    if (!this.client?.user) return
    const activities = []
    if (this.activityText) {
      const type = ACTIVITY_TYPE_MAP[this.activityType] ?? ActivityType.Playing
      activities.push({ name: this.activityText.slice(0, 128), type })
    }
    this.client.user.setPresence({ status: this.presenceStatus, activities })
  }

  applyPresenceRuntime({ presenceStatus, activityType, activityText }) {
    if (!this.isRunning()) return
    if (presenceStatus !== undefined && PRESENCE_STATUS_VALUES.includes(presenceStatus)) {
      this.presenceStatus = presenceStatus
    }
    if (activityType !== undefined) this.activityType = activityType || 'Playing'
    if (activityText !== undefined) this.activityText = activityText || null
    this._applyPresence()
  }
}

module.exports = { LiteClient, PRESENCE_STATUS_VALUES, ACTIVITY_TYPE_MAP }
