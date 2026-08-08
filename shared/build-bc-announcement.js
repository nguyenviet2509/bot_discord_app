// Build content + embeds cho thong bao BlessCastle sau khi chot tuan.
// Dung boi ca dashboard route /finalize va bot cron auto-finalize.

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000
const MAX_DESC_CHARS = 3800
const MAX_EMBEDS = 10

function pad2(n) { return String(n).padStart(2, '0') }

// Format DD-MM-YYYY (Asia/Saigon)
function formatSaigonDate(ms) {
  const d = new Date(ms + TZ_OFFSET_MS)
  return `${pad2(d.getUTCDate())}-${pad2(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`
}

// Tinh ngay thu 6 cua tuan ISO (Mon-Sun).
// Cron auto-finalize chay Sun 21:00, tuc la 2 ngay sau Fri.
function fridayOfCurrentWeek(nowMs) {
  const d = new Date(nowMs + TZ_OFFSET_MS)
  const dow = d.getUTCDay() || 7 // Mon=1..Sun=7
  const daysSinceFri = (dow >= 5) ? (dow - 5) : (dow + 2)
  const friUtc = new Date(d)
  friUtc.setUTCDate(d.getUTCDate() - daysSinceFri)
  // Tra ve unix ms cua Fri 00:00 Saigon
  const y = friUtc.getUTCFullYear(), m = friUtc.getUTCMonth(), day = friUtc.getUTCDate()
  return Date.UTC(y, m, day) - TZ_OFFSET_MS
}

// Substitute placeholders trong template.
function renderTemplate(template, placeholders) {
  let out = String(template || '')
  for (const [k, v] of Object.entries(placeholders)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
  }
  return out
}

// starsRows: array cua { user_id, stars, last_updated } (DESC by stars, then last_updated ASC)
// membersMap: Map<userId, { username, avatar }>
// template: string content voi placeholders
// weekKey: string YYYY-WW (chi de log/debug, khong hien thi)
function buildAnnouncement({ starsRows, membersMap, template, nowMs = Date.now() }) {
  const friMs = fridayOfCurrentWeek(nowMs)
  const deadlineMs = nowMs + 2 * 86400 * 1000 // 2 ngay sau khi chot
  const content = renderTemplate(template, {
    week_date: formatSaigonDate(friMs),
    deadline_date: formatSaigonDate(deadlineMs),
  })

  // Build leaderboard lines
  const lines = []
  for (let i = 0; i < starsRows.length; i++) {
    const r = starsRows[i]
    const mention = `<@${r.user_id}>`
    lines.push(`**${i + 1}.** ${mention} — **${r.stars}** ⭐`)
  }

  // Chia thanh chunks
  const chunks = []
  let cur = [], curLen = 0
  for (const line of lines) {
    const addLen = line.length + 1
    if (curLen + addLen > MAX_DESC_CHARS && cur.length > 0) {
      chunks.push(cur); cur = []; curLen = 0
    }
    cur.push(line); curLen += addLen
  }
  if (cur.length > 0) chunks.push(cur)

  const embeds = chunks.slice(0, MAX_EMBEDS).map((chunk, idx) => {
    const eb = { color: 0xfbbf24, description: chunk.join('\n') }
    if (idx === 0) eb.title = '🏰 BlessCastle Leaderboard'
    if (idx === chunks.length - 1) {
      eb.footer = { text: `${starsRows.length} thành viên có sao` }
      eb.timestamp = new Date().toISOString()
    }
    return eb
  })

  // Neu khong co ai co sao, van gui content + 1 embed placeholder
  if (embeds.length === 0) {
    embeds.push({
      color: 0xfbbf24,
      title: '🏰 BlessCastle Leaderboard',
      description: '_Chưa có thành viên nào có sao trong tuần này._',
      timestamp: new Date().toISOString(),
    })
  }

  return {
    content,
    embeds,
    allowed_mentions: { parse: ['everyone', 'users', 'roles'] },
  }
}

module.exports = { buildAnnouncement, formatSaigonDate, fridayOfCurrentWeek }
