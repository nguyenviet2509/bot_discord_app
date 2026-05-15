// Helper tinh fire-time cho scheduled message theo gio co dinh (Asia/Saigon, UTC+7, khong co DST).
// schedule_time: 'HH:MM' (24h)
// schedule_weekday: 0-6 (0=Chu Nhat ... 6=Thu Bay) hoac null = moi ngay

const VN_OFFSET_SEC = 7 * 3600

// Tra ve unix seconds cua lan fire gan nhat <= nowSec ung voi (HH:MM, weekday) trong mui gio VN.
// Neu chua bao gio fire trong qua khu (chua toi gio hom nay va weekday khac), van tra ve gia tri qua khu hop le.
function lastFireUnix(nowSec, hhmm, weekday) {
  const [hStr, mStr] = String(hhmm || '00:00').split(':')
  const hh = Number(hStr) || 0
  const mm = Number(mStr) || 0

  // Lay date-fields cua "hien tai theo gio VN" bang cach shift +7h roi doc UTC fields
  const vnDate = new Date((nowSec + VN_OFFSET_SEC) * 1000)
  const y = vnDate.getUTCFullYear()
  const mo = vnDate.getUTCMonth()
  const d = vnDate.getUTCDate()
  const currentWeekdayVN = vnDate.getUTCDay()

  // Unix seconds cua "hom nay HH:MM" theo gio VN
  const todayFireUtcMs = Date.UTC(y, mo, d, hh, mm, 0) - VN_OFFSET_SEC * 1000
  let candidate = Math.floor(todayFireUtcMs / 1000)

  if (weekday === null || weekday === undefined || weekday === '') {
    // moi ngay: neu hom nay chua toi gio → lui ve hom qua
    if (candidate > nowSec) candidate -= 86400
    return candidate
  }

  const wd = Number(weekday)
  let daysBack = (currentWeekdayVN - wd + 7) % 7
  // Neu hom nay dung weekday nhung chua toi gio → fire gan nhat la tuan truoc
  if (daysBack === 0 && candidate > nowSec) daysBack = 7
  candidate -= daysBack * 86400
  return candidate
}

// Kiem tra msg co toi luc gui hay khong (cron mode).
function isDueByClock(msg, nowSec) {
  if (!msg.schedule_time) return false
  const fire = lastFireUnix(nowSec, msg.schedule_time, msg.schedule_weekday)
  if (nowSec < fire) return false
  if (!msg.last_sent_at) return true
  return msg.last_sent_at < fire
}

// Interval mode voi anchor (start_time HH:MM, gio VN):
// Anchor neo vao "hom nay HH:MM" (hoac hom qua neu chua toi gio hom nay).
// Cac lan fire = anchor + n * interval_sec. Tra ve lan fire gan nhat <= nowSec.
function lastIntervalFireUnix(nowSec, intervalMinutes, startHHMM) {
  const intervalSec = Math.max(1, Number(intervalMinutes) || 1) * 60
  const [hStr, mStr] = String(startHHMM || '00:00').split(':')
  const hh = Number(hStr) || 0
  const mm = Number(mStr) || 0

  const vnDate = new Date((nowSec + VN_OFFSET_SEC) * 1000)
  const y = vnDate.getUTCFullYear()
  const mo = vnDate.getUTCMonth()
  const d = vnDate.getUTCDate()

  let anchor = Math.floor((Date.UTC(y, mo, d, hh, mm, 0) - VN_OFFSET_SEC * 1000) / 1000)
  if (anchor > nowSec) anchor -= 86400 // chua toi gio hom nay → dung anchor hom qua
  const n = Math.floor((nowSec - anchor) / intervalSec)
  return anchor + n * intervalSec
}

function isDueByInterval(msg, nowSec) {
  if (!msg.start_time) return false
  const fire = lastIntervalFireUnix(nowSec, msg.interval_minutes, msg.start_time)
  if (nowSec < fire) return false
  if (!msg.last_sent_at) return true
  return msg.last_sent_at < fire
}

module.exports = { lastFireUnix, isDueByClock, lastIntervalFireUnix, isDueByInterval }
