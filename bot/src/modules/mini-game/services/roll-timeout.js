// In-memory timer manager cho ROLL session (giong match-timeout.js).
// Map<sessionId, Timeout>. Mat khi bot restart -> sweepOnStartup re-schedule.

const timers = new Map()

function set(sessionId, ms, fn) {
  clear(sessionId)
  const t = setTimeout(() => {
    timers.delete(sessionId)
    Promise.resolve().then(fn).catch(err => console.error('[roll:timeout]', err))
  }, ms)
  timers.set(sessionId, t)
}

function clear(sessionId) {
  const t = timers.get(sessionId)
  if (t) { clearTimeout(t); timers.delete(sessionId) }
}

module.exports = { set, clear }
