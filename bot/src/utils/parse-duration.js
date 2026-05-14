// Parse duration string nhu "10m", "2h", "7d" → milliseconds
const UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

function parseDuration(str) {
  if (!str) return null
  const m = String(str).trim().toLowerCase().match(/^(\d+)\s*([smhd])$/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n * UNITS[m[2]]
}

function formatDuration(ms) {
  if (ms < 60_000) return `${Math.floor(ms / 1000)} giây`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} phút`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} giờ`
  return `${Math.floor(ms / 86_400_000)} ngày`
}

module.exports = { parseDuration, formatDuration }
