// BlessCastle voice tracker: track voice presence trong khung Fri 20-21h Asia/Saigon.
// Auto-loaded qua bot/src/index.js events loader.
// Bot restart giua phien -> chap nhan mat data (KISS).

const bcDb = require('../../../shared/db-blesscastle')

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000

// In-memory Map: guildId::userId -> { channelId, joinMs }
const joinTimes = new Map()

function key(guildId, userId) { return `${guildId}::${userId}` }

// Tra ve so giay trong khoang [fromMs, toMs] nam trong "Fri sessionStartHour..sessionEndHour" Saigon.
// Neu env BLESSCASTLE_TEST_MODE=1 -> bypass check day-of-week (accept moi ngay) de test.
function clipToFridayWindow(fromMs, toMs, cfg) {
  if (toMs <= fromMs) return 0
  const startHour = cfg.sessionStartHour
  const endHour = cfg.sessionEndHour
  const bypassDayCheck = process.env.BLESSCASTLE_TEST_MODE === '1'
  let total = 0
  const stepMs = 60_000
  let cur = fromMs
  while (cur < toMs) {
    const next = Math.min(cur + stepMs, toMs)
    const mid = cur + (next - cur) / 2
    const sd = new Date(mid + TZ_OFFSET_MS)
    const dow = sd.getUTCDay() || 7 // Mon=1..Sun=7 (Fri=5)
    const hour = sd.getUTCHours()
    const dayOk = bypassDayCheck || dow === 5
    if (dayOk && hour >= startHour && hour < endHour) {
      total += Math.floor((next - cur) / 1000)
    }
    cur = next
  }
  return total
}

// Commit interval voi 1 user: clip vao khung Fri 20-21h, cong vao attendance
function commitInterval(guildId, userId, fromMs, toMs, cfg) {
  const seconds = clipToFridayWindow(fromMs, toMs, cfg)
  if (seconds <= 0) return
  const weekKey = bcDb.currentWeekKey(fromMs)
  bcDb.addVoiceSeconds(guildId, userId, weekKey, seconds)
}

module.exports = {
  name: 'voiceStateUpdate',
  execute(oldState, newState) {
    const member = newState.member || oldState.member
    if (!member || member.user.bot) return
    const guild = newState.guild || oldState.guild
    if (!guild) return

    const oldCh = oldState.channelId
    const newCh = newState.channelId
    if (oldCh === newCh) return

    const cfg = bcDb.getConfig(guild.id)
    if (!cfg.enabled || cfg.voiceChannelIds.length === 0) return

    const watched = cfg.voiceChannelIds
    const wasWatched = !!(oldCh && watched.includes(oldCh))
    const isWatched = !!(newCh && watched.includes(newCh))
    const now = Date.now()

    try {
      if (wasWatched && !isWatched) {
        const rec = joinTimes.get(key(guild.id, member.id))
        if (rec) {
          commitInterval(guild.id, member.id, rec.joinMs, now, cfg)
          joinTimes.delete(key(guild.id, member.id))
        }
      } else if (!wasWatched && isWatched) {
        joinTimes.set(key(guild.id, member.id), { channelId: newCh, joinMs: now })
      } else if (wasWatched && isWatched) {
        const rec = joinTimes.get(key(guild.id, member.id))
        if (rec) commitInterval(guild.id, member.id, rec.joinMs, now, cfg)
        joinTimes.set(key(guild.id, member.id), { channelId: newCh, joinMs: now })
      }
    } catch (err) {
      console.error('[BlessCastle] voice tracker error:', err.message)
    }
  },
  // Expose for scheduler to flush at week finalize (optional)
  _joinTimes: joinTimes,
  _commitInterval: commitInterval,
  _clipToFridayWindow: clipToFridayWindow,
}
