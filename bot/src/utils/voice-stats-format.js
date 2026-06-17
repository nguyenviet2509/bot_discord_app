// Helpers format cho voice stats: render duration "Hh Mm" va resolve range preset → unix sec bounds.

// Asia/Saigon (UTC+7), khong DST → fix offset don gian.
const SAIGON_OFFSET_SEC = 7 * 3600

// Format seconds → human-readable string: "12h 34m", "45m 12s", "23s".
function formatDuration(totalSec) {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

// Tinh range bounds (unix sec) cho preset: today | 7d | 30d | all.
// 'today' = tu 00:00 Asia/Saigon hom nay tro di.
function getRangeBounds(rangeKey) {
  const now = Math.floor(Date.now() / 1000)
  let from = 0
  let label = 'tat ca'
  switch (rangeKey) {
    case 'today': {
      // Day boundary theo Asia/Saigon: shift +7h, lay phan ngay, shift lai.
      const saigonNow = now + SAIGON_OFFSET_SEC
      const startOfDaySaigon = Math.floor(saigonNow / 86400) * 86400
      from = startOfDaySaigon - SAIGON_OFFSET_SEC
      label = 'hom nay'
      break
    }
    case '7d':
      from = now - 7 * 86400
      label = '7 ngay qua'
      break
    case '30d':
      from = now - 30 * 86400
      label = '30 ngay qua'
      break
    case 'all':
    default:
      from = 0
      label = 'tat ca thoi gian'
      break
  }
  return { from, to: now, label }
}

module.exports = { formatDuration, getRangeBounds }
