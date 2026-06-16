// Worker tick moi 60s: kiem tra events co recurrence='weekly' den moc day_of_week + time
// (Asia/Saigon), random pick 1 member co role recurrence_pool_role_id, gui template.
// - {member} -> mention <@id>
// - Tranh double-fire: chi run neu (now - last_run_at) >= 6 ngay HOAC last_run null
// - Timezone: Asia/Saigon (UTC+7) fixed

const eventsDb = require('../../../shared/db-events')
const { sendEventAnnouncement } = require('../../../shared/send-event-announcement')

const TZ = 'Asia/Saigon'

// Tra ve { dayOfWeek: 0-6 (CN=0), hhmm: 'HH:MM' } theo TZ
function nowInTz() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const map = {}
  for (const p of parts) map[p.type] = p.value
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const hh = map.hour === '24' ? '00' : map.hour
  return { dayOfWeek: dayMap[map.weekday], hhmm: `${hh}:${map.minute}` }
}

async function pickRandomMember(client, guildId, roleId) {
  const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null)
  if (!guild) return null
  // Fetch tat ca members de role.members cache day du
  try { await guild.members.fetch() } catch (_) {}
  const role = guild.roles.cache.get(roleId)
  if (!role) return null
  const candidates = [...role.members.values()].filter(m => !m.user.bot)
  if (candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

async function tick(client) {
  const { dayOfWeek, hhmm } = nowInTz()
  const nowSec = Math.floor(Date.now() / 1000)
  const SIX_DAYS = 6 * 24 * 3600

  // 1. Lich dinh ky gui THONG BAO SU KIEN (dung announce_content hien co)
  const announceEvents = eventsDb.getActiveAnnounceRecurringEvents()
  for (const ev of announceEvents) {
    if (ev.announce_recur_day_of_week !== dayOfWeek) continue
    if (ev.announce_recur_time !== hhmm) continue
    if (ev.announce_recur_last_run_at && nowSec - ev.announce_recur_last_run_at < SIX_DAYS) continue
    try {
      const result = await sendEventAnnouncement(ev)
      if (result.ok) {
        eventsDb.markAnnounceRecurrenceRun(ev.id)
        console.log(`[event-recurrence] Announce sent event id=${ev.id}`)
      } else {
        console.warn(`[event-recurrence] Announce send fail id=${ev.id}: ${result.error}`)
      }
    } catch (err) {
      console.error(`[event-recurrence] Announce error id=${ev.id}:`, err.message)
    }
  }

  // 2. Lich dinh ky gui THONG BAO KET QUA (random pick member)
  const resultEvents = eventsDb.getActiveRecurringEvents()
  for (const ev of resultEvents) {
    if (ev.recurrence_day_of_week !== dayOfWeek) continue
    if (ev.recurrence_time !== hhmm) continue
    if (ev.recurrence_last_run_at && nowSec - ev.recurrence_last_run_at < SIX_DAYS) continue

    try {
      const member = await pickRandomMember(client, ev.guild_id, ev.recurrence_pool_role_id)
      if (!member) {
        console.warn(`[event-recurrence] No eligible member for event id=${ev.id} role=${ev.recurrence_pool_role_id}`)
        continue
      }
      const content = (ev.recurrence_template || '').replace(/\{member\}/g, `<@${member.id}>`)
      // Plain content de mention ping that su (khong dung embed)
      const shaped = { ...ev, announce_content: content, announce_use_embed: 0, announce_image_url: null }
      const result = await sendEventAnnouncement(shaped)
      if (result.ok) {
        eventsDb.markRecurrenceRun(ev.id)
        console.log(`[event-recurrence] Result sent event id=${ev.id} picked=${member.user.tag} (${member.id})`)
      } else {
        console.warn(`[event-recurrence] Result send fail id=${ev.id}: ${result.error}`)
      }
    } catch (err) {
      console.error(`[event-recurrence] Result error id=${ev.id}:`, err.message)
    }
  }
}

function start(client) {
  setInterval(() => tick(client).catch(err => console.error('[event-recurrence] tick error:', err.message)), 60_000)
  console.log('[event-recurrence] Worker started (tick 60s, timezone Asia/Saigon)')
}

module.exports = { start, tick, nowInTz, pickRandomMember }
