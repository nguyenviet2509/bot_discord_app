// Schedule task chay vao 00:00 local time moi ngay.
// TZ_OFFSET_HOURS = offset so voi UTC (mac dinh +7 cho Asia/Saigon).
const TZ_OFFSET_HOURS = Number(process.env.TZ_OFFSET_HOURS ?? 7)
const ONE_DAY_MS = 86_400_000

function msUntilNextLocalMidnight() {
  const nowUtc = Date.now()
  const localNowMs = nowUtc + TZ_OFFSET_HOURS * 3600_000
  // Next 00:00 trong "shifted local time"
  const localDate = new Date(localNowMs)
  const nextLocalMidnight = Date.UTC(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth(),
    localDate.getUTCDate() + 1,
    0, 0, 0, 0
  )
  return nextLocalMidnight - localNowMs
}

function scheduleDaily(name, task) {
  const runAndReschedule = async () => {
    console.log(`[Cron] Running daily task: ${name}`)
    try { await task() } catch (err) { console.error(`[Cron] ${name} failed:`, err.message) }
    setTimeout(runAndReschedule, ONE_DAY_MS)
  }
  const initialDelay = msUntilNextLocalMidnight()
  const nextRun = new Date(Date.now() + initialDelay).toISOString()
  console.log(`[Cron] Scheduled "${name}" — next run at ${nextRun} (in ${Math.round(initialDelay/60000)}m)`)
  setTimeout(runAndReschedule, initialDelay)
}

module.exports = { scheduleDaily }
