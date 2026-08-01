// BlessCastle scheduler:
// - Sun 21:00 Saigon: auto-finalize tuan + dong tuan (setClosedWeek)
// - Daily 03:00 Saigon: purge soft-deleted > 7 ngay
//
// Dung setInterval tick 60s + idempotency qua bang bot_meta.

const bcDb = require('../../../shared/db-blesscastle')

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000
const SEVEN_DAYS_SEC = 7 * 86400

function saigonNow() {
  return new Date(Date.now() + TZ_OFFSET_MS)
}

function metaGet(key) {
  const row = require('../../../shared/db').getDb()
    .prepare('SELECT value FROM bot_meta WHERE key = ?').get(key)
  return row ? row.value : null
}

function metaSet(key, value) {
  require('../../../shared/db').getDb()
    .prepare('INSERT OR REPLACE INTO bot_meta (key, value) VALUES (?, ?)').run(key, String(value))
}

// Sun 21:00 Saigon finalize: chi chay 1 lan per weekKey per guild.
// Sau finalize -> setClosedWeek de tuan bi khoa, activeWeekKey advance sang tuan sau.
async function tryFinalize() {
  const s = saigonNow()
  const dow = s.getUTCDay() || 7 // Mon=1..Sun=7
  const hour = s.getUTCHours()
  if (dow !== 7 || hour !== 21) return

  const weekKey = bcDb.currentWeekKey()
  const lastKey = metaGet('bc_last_finalize_week')
  if (lastKey === weekKey) return

  const guildIds = bcDb.listEnabledGuildIds()
  for (const gid of guildIds) {
    try {
      const cfg = bcDb.getConfig(gid)
      // Flush voice tracker in-memory intervals dang mo (best-effort)
      flushOpenSessions(gid, cfg)
      const awarded = bcDb.finalizeWeek(gid, weekKey, cfg.minMinutes * 60)
      bcDb.setClosedWeek(gid, weekKey) // Dong tuan -> UI advance sang tuan sau
      console.log(`[BlessCastle] Auto-finalize guild=${gid} week=${weekKey} awarded=${awarded.length}`)
    } catch (err) {
      console.error(`[BlessCastle] Finalize guild=${gid} error:`, err.message)
    }
  }
  metaSet('bc_last_finalize_week', weekKey)
}

// Flush open voice sessions (user con dang trong watched channel luc chot tuan)
function flushOpenSessions(guildId, cfg) {
  try {
    const tracker = require('../events/blesscastle-voice-tracker')
    const now = Date.now()
    for (const [k, rec] of tracker._joinTimes.entries()) {
      if (!k.startsWith(`${guildId}::`)) continue
      const userId = k.slice(guildId.length + 2)
      tracker._commitInterval(guildId, userId, rec.joinMs, now, cfg)
      rec.joinMs = now // reset joinMs de tranh double-count neu con dang trong voice
    }
  } catch (err) {
    console.error('[BlessCastle] flush open sessions:', err.message)
  }
}

// Daily 03:00 cleanup: purge soft-deleted > 7 ngay
function tryCleanup() {
  const s = saigonNow()
  const hour = s.getUTCHours()
  if (hour !== 3) return

  const today = `${s.getUTCFullYear()}-${s.getUTCMonth()+1}-${s.getUTCDate()}`
  const lastRun = metaGet('bc_last_cleanup_day')
  if (lastRun === today) return

  try {
    const cutoff = Math.floor(Date.now() / 1000) - SEVEN_DAYS_SEC
    const n = bcDb.purgeSoftDeleted(cutoff)
    console.log(`[BlessCastle] Cleanup purged ${n} soft-deleted record(s)`)
  } catch (err) {
    console.error('[BlessCastle] cleanup error:', err.message)
  }
  metaSet('bc_last_cleanup_day', today)
}

function start(client) {
  // Bao dam bot_meta ton tai
  require('../../../shared/db').getDb().exec(`CREATE TABLE IF NOT EXISTS bot_meta (key TEXT PRIMARY KEY, value TEXT)`)

  const tracker = require('../events/blesscastle-voice-tracker')

  // Startup sweep: capture users dang trong watched channel luc bot online
  if (client) {
    try {
      const swept = tracker.sweepCurrentVoiceStates(client)
      if (swept > 0) console.log(`[BlessCastle] Startup sweep: captured ${swept} ongoing voice session(s)`)
    } catch (err) {
      console.error('[BlessCastle] startup sweep error:', err.message)
    }
  }

  console.log('[BlessCastle] Scheduler started (tick 60s: finalize + cleanup + voice checkpoint)')
  setInterval(() => {
    tryFinalize()
    tryCleanup()
    // Voice checkpoint: chong mat data neu bot restart, va bat user da vao voice
    // trong luc bot chua enable / bot vua restart
    if (client) {
      try {
        // Truoc khi checkpoint, sweep them user moi dang trong voice ma chua co trong joinTimes
        // (ex: admin vua enable config sau khi user da vao voice)
        for (const [guildId, guild] of client.guilds.cache) {
          const cfg = bcDb.getConfig(guildId)
          if (!cfg.enabled || cfg.voiceChannelIds.length === 0) continue
          const now = Date.now()
          for (const [, vs] of guild.voiceStates.cache) {
            if (!vs.channelId || !cfg.voiceChannelIds.includes(vs.channelId)) continue
            if (vs.member?.user?.bot) continue
            const k = `${guildId}::${vs.id}`
            if (!tracker._joinTimes.has(k)) {
              tracker._joinTimes.set(k, { channelId: vs.channelId, joinMs: now })
            }
          }
        }
        tracker.checkpointOpenSessions(client)
      } catch (err) {
        console.error('[BlessCastle] checkpoint error:', err.message)
      }
    }
  }, 60_000)
}

module.exports = { start, _tryFinalize: tryFinalize, _tryCleanup: tryCleanup }
