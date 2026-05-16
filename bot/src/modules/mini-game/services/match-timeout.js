// Quan ly setTimeout cho tung match - tu dong huy/settle khi het gio.
// In-memory Map, mat khi bot restart (chap nhan: match qua 60s vo le se het ngot,
// admin co the cleanup bang query SQL neu can).

const timers = new Map() // matchId -> Timeout

function set(matchId, ms, fn) {
  clear(matchId)
  const t = setTimeout(() => {
    timers.delete(matchId)
    Promise.resolve().then(fn).catch(err => console.error('[mg:timeout]', err))
  }, ms)
  timers.set(matchId, t)
}

function clear(matchId) {
  const t = timers.get(matchId)
  if (t) { clearTimeout(t); timers.delete(matchId) }
}

module.exports = { set, clear }
