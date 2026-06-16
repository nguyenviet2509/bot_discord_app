// Tach template multi-line thanh nhieu cau, random pick 1.
// - Moi dong (split \r?\n) sau khi trim != '' la 1 candidate
// - 0 dong -> '', 1 dong -> dong do, N dong -> random
// Dung chung boi:
//   - bot/src/utils/event-recurrence-worker.js (worker tick)
//   - dashboard/routes/events.js (test-send endpoint)
function pickRandomTemplate(raw) {
  if (!raw) return ''
  const lines = String(raw).split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  if (lines.length === 0) return ''
  return lines[Math.floor(Math.random() * lines.length)]
}

module.exports = { pickRandomTemplate }
