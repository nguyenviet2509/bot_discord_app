// Action engine: ap dung ladder (warn → mute 5m → mute 1h → kick) khi co vi pham.
// Goi tu event message-create sau khi rules-engine detect violation.
//
// Ladder duoc luu trong automod_config voi rule_name='__ladder__', params:
//   { steps: ['warn', 'mute-5m', 'mute-1h', 'kick'], expirySec: 86400 }

const dbAutomod = require('../../../../shared/db-automod')
const dbCore = require('../../../../shared/db')

const DEFAULT_LADDER = {
  steps: ['warn', 'mute-5m', 'mute-1h', 'kick'],
  expirySec: 86400,
}

function getLadder(guildId) {
  const cfg = dbAutomod.getRuleConfig(guildId, '__ladder__')
  if (cfg && cfg.params && Array.isArray(cfg.params.steps) && cfg.params.steps.length > 0) {
    return {
      steps: cfg.params.steps,
      expirySec: cfg.params.expirySec || DEFAULT_LADDER.expirySec,
    }
  }
  return DEFAULT_LADDER
}

// Chon action dua tren warn count (1-indexed). Neu vuot index, dung step cuoi.
function pickAction(warnCount, ladder) {
  const idx = Math.max(0, Math.min(warnCount - 1, ladder.steps.length - 1))
  return ladder.steps[idx] || 'warn'
}

// Chuyen action string -> duration ms (cho mute) hoac null.
function muteDurationMs(action) {
  if (action === 'mute-5m') return 5 * 60 * 1000
  if (action === 'mute-1h') return 60 * 60 * 1000
  if (action === 'mute-1d') return 24 * 60 * 60 * 1000
  return null
}

async function notifyUser(message, action, rule, reason) {
  const text = `⚠️ Tin nhắn của bạn ở server **${message.guild.name}** vi phạm quy tắc **${rule}** (${reason}).\nHành động: \`${action}\``
  try {
    await message.author.send(text)
    return
  } catch (_) {
    // DM that bai -> fallback gui channel ephemeral-like (auto-delete 10s)
  }
  try {
    const fallback = await message.channel.send({
      content: `<@${message.author.id}> ${text}`,
      allowedMentions: { users: [message.author.id] },
    })
    setTimeout(() => { fallback.delete().catch(() => {}) }, 10000)
  } catch (_) {}
}

async function applyAction(message, violation) {
  const { rule, reason } = violation
  const guildId = message.guild.id
  const userId = message.author.id

  // 1. Ghi nhan warn
  dbAutomod.addWarn(guildId, userId, rule)
  const ladder = getLadder(guildId)
  const warnCount = dbAutomod.countActiveWarns(guildId, userId, ladder.expirySec)
  const action = pickAction(warnCount, ladder)

  // 2. Xoa tin (luon)
  await message.delete().catch(() => {})

  // 3. Ap dung punishment
  const muteMs = muteDurationMs(action)
  if (muteMs && message.member) {
    await message.member.timeout(muteMs, `[Auto-Mod] ${rule}: ${reason}`).catch(err => {
      console.warn('[auto-mod] timeout fail:', err.message)
    })
    // Log moderation action chinh thuc de hien trong dashboard mod log
    try {
      dbCore.logModAction({
        guild_id: guildId,
        action_type: 'mute',
        user_id: userId,
        user_tag: message.author.tag || message.author.username || null,
        user_avatar: message.author.avatar || null,
        moderator_id: 'auto-mod',
        moderator_tag: 'Auto-Mod',
        reason: `[${rule}] ${reason}`,
        duration_ms: muteMs,
        expires_at: Math.floor((Date.now() + muteMs) / 1000),
      })
    } catch (_) {}
  } else if (action === 'kick' && message.member) {
    await message.member.kick(`[Auto-Mod] ${rule}: ${reason}`).catch(err => {
      console.warn('[auto-mod] kick fail:', err.message)
    })
    try {
      dbCore.logModAction({
        guild_id: guildId,
        action_type: 'kick',
        user_id: userId,
        user_tag: message.author.tag || message.author.username || null,
        user_avatar: message.author.avatar || null,
        moderator_id: 'auto-mod',
        moderator_tag: 'Auto-Mod',
        reason: `[${rule}] ${reason}`,
      })
    } catch (_) {}
  }

  // 4. Notify user
  await notifyUser(message, action, rule, reason)

  // 5. Log audit
  try {
    dbAutomod.addLog({
      guildId,
      userId,
      rule,
      action,
      messageExcerpt: (message.content || '').slice(0, 200),
      channelId: message.channel.id,
    })
  } catch (err) {
    console.error('[auto-mod] log fail:', err.message)
  }
}

module.exports = { applyAction, pickAction, getLadder }
