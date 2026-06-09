// Auto-chatter: per-bot scheduler gui tin nhan random tu list cau custom.
// Goi setTimeout cho moi bot, tick → pick random message → channel.send.
//
// Human-like features:
//   - sendTyping() + delay ti le do dai message (50-100ms/char, cap 0.8-8s)
//   - Khong pick trung cau vua gui lien tiep (in-memory Map)
//   - Skip tick neu channel im lang qua nguong (config silence_skip_hours)
//
// Khong persist last-message — restart bot reset OK.

const dbManaged = require('../shared/db-managed-bots')

const timers = new Map()         // botId → Timeout
const lastMessageId = new Map()  // botId → message id vua pick (anti-repeat)

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function pickMessage(botId, messages) {
  if (messages.length === 1) {
    lastMessageId.set(botId, messages[0].id)
    return messages[0]
  }
  const lastId = lastMessageId.get(botId)
  const pool = messages.filter((m) => m.id !== lastId)
  const list = pool.length > 0 ? pool : messages
  const picked = list[Math.floor(Math.random() * list.length)]
  lastMessageId.set(botId, picked.id)
  return picked
}

function randomDelayMs(cfg) {
  const min = Math.max(1, cfg.min_minutes)
  const max = Math.max(min, cfg.max_minutes)
  const minutes = Math.random() * (max - min) + min
  return Math.floor(minutes * 60 * 1000)
}

async function isChannelSilent(channel, silenceSkipHours) {
  if (!silenceSkipHours || silenceSkipHours <= 0) return false
  try {
    const fetched = await channel.messages.fetch({ limit: 1 })
    const last = fetched.first()
    if (!last) return true // channel rong → coi nhu im lang
    const ageMs = Date.now() - last.createdTimestamp
    return ageMs > silenceSkipHours * 3600 * 1000
  } catch (err) {
    // Khong fetch duoc (thieu quyen / API loi) → khong skip, cu gui
    console.error(`[auto-chatter] silence check fail: ${err.message}`)
    return false
  }
}

async function sendWithTyping(channel, content) {
  try {
    await channel.sendTyping()
    const msPerChar = 50 + Math.random() * 50
    const typingMs = Math.min(8000, Math.max(800, content.length * msPerChar))
    await sleep(typingMs)
  } catch (_) {
    // sendTyping fail (thieu quyen) → bo qua, van gui
  }
  await channel.send(content)
}

async function tick(botId, getClient) {
  const cfg = dbManaged.getAutochatConfig(botId)
  if (!cfg || !cfg.enabled || !cfg.channel_id) {
    cancel(botId)
    return
  }

  const client = getClient(botId)
  if (!client?.isRunning()) {
    // Bot chua ready → reschedule, khong gui
    scheduleNext(botId, getClient, cfg)
    return
  }

  const messages = dbManaged.listMessages(botId)
  if (messages.length === 0) {
    // Khong co cau → reschedule, doi user them
    scheduleNext(botId, getClient, cfg)
    return
  }

  try {
    const channel = await client.client.channels.fetch(cfg.channel_id)
    if (!channel?.isTextBased()) {
      console.error(`[auto-chatter#${botId}] channel khong phai text-based`)
      scheduleNext(botId, getClient, cfg)
      return
    }

    if (await isChannelSilent(channel, cfg.silence_skip_hours)) {
      console.log(`[auto-chatter#${botId}] skip: channel im lang > ${cfg.silence_skip_hours}h`)
      scheduleNext(botId, getClient, cfg)
      return
    }

    const msg = pickMessage(botId, messages)
    await sendWithTyping(channel, msg.content)
    console.log(`[auto-chatter#${botId}] sent message #${msg.id}`)
  } catch (err) {
    console.error(`[auto-chatter#${botId}] send fail: ${err.message}`)
  }
  scheduleNext(botId, getClient, cfg)
}

function scheduleNext(botId, getClient, cfg) {
  const delayMs = randomDelayMs(cfg)
  const timer = setTimeout(() => tick(botId, getClient), delayMs)
  timers.set(botId, timer)
  const minutes = Math.round(delayMs / 60000)
  console.log(`[auto-chatter#${botId}] next tick in ~${minutes} phut`)
}

// Cancel + reschedule. Delay dau tien cung random — khong gui ngay khi start.
function schedule(botId, getClient) {
  cancel(botId)
  const cfg = dbManaged.getAutochatConfig(botId)
  if (!cfg || !cfg.enabled || !cfg.channel_id) return
  scheduleNext(botId, getClient, cfg)
}

function cancel(botId) {
  const t = timers.get(botId)
  if (t) {
    clearTimeout(t)
    timers.delete(botId)
  }
}

function cancelAll() {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
}

function isScheduled(botId) {
  return timers.has(botId)
}

// Gui ngay 1 message random (test button). Van di qua typing-delay de user thay
// behavior that. Khong reschedule — chi 1 lan.
async function sendOnce(botId, getClient) {
  const cfg = dbManaged.getAutochatConfig(botId)
  if (!cfg || !cfg.channel_id) throw new Error('Chua cau hinh channel')
  const client = getClient(botId)
  if (!client?.isRunning()) throw new Error('Bot chua chay')
  const messages = dbManaged.listMessages(botId)
  if (messages.length === 0) throw new Error('Chua co cau chat nao')
  const channel = await client.client.channels.fetch(cfg.channel_id)
  if (!channel?.isTextBased()) throw new Error('Channel khong phai text-based')
  const msg = pickMessage(botId, messages)
  await sendWithTyping(channel, msg.content)
  return { messageId: msg.id, content: msg.content }
}

module.exports = {
  schedule,
  cancel,
  cancelAll,
  isScheduled,
  sendOnce,
}
