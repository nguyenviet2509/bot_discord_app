// One-time seed: nap lich thi dau vong bang WC 2026 (parse tu lich phat song VTV).
// - Gio kick-off luu theo timezone Asia/Saigon (UTC+7), convert sang UTC ms khi insert
// - Idempotent: skip neu match da ton tai (same teams + same kickOffAt)
//
// Chay: node tools/seed-wc2026-group-stage.js
// Hoac qua dashboard endpoint POST /api/worldcup/matches/bulk (file nay tra ve mang)
//
// LUU Y: du lieu parse tu anh nguoi dung gui, co the co sai sot.
// Vui long kiem tra lai trong dashboard sau khi import.

// Format: [day MM-DD, time HH:MM, group A-L|null, team1_code, team2_code]
// Round 1 = vong 1, Round 2 = vong 2, Round 3 = vong 3 (rieng cho group stage)
const SCHEDULE = {
  round1: [
    ['06-15', '00:00', 'E', 'GER', 'CUW'],
    ['06-15', '03:00', 'F', 'NED', 'JPN'],
    ['06-15', '06:00', 'E', 'CIV', 'ECU'],
    ['06-15', '09:00', 'G', 'SWE', 'TUN'],
    ['06-15', '23:00', 'H', 'ESP', 'CPV'],
    ['06-16', '02:00', 'G', 'BEL', 'EGY'],
    ['06-16', '05:00', 'I', 'KSA', 'URU'],
    ['06-16', '08:00', 'J', 'IRN', 'NZL'],
    ['06-17', '11:00', 'I', 'FRA', 'SEN'],
    ['06-17', '14:00', 'F', 'IRQ', 'NOR'],
    ['06-17', '19:00', 'J', 'ARG', 'ALG'],
    ['06-17', '22:00', 'K', 'AUT', 'JOR'],
    ['06-18', '01:00', 'L', 'POR', 'CGO'],
    ['06-18', '04:00', 'K', 'ENG', 'CRO'],
    ['06-18', '07:00', 'L', 'GHA', 'PAN'],
    ['06-18', '10:00', 'H', 'UZB', 'COL'],
    ['06-18', '23:00', 'B', 'CZE', 'RSA'],
    ['06-19', '02:00', 'C', 'SUI', 'BIH'],
    ['06-19', '05:00', 'C', 'CAN', 'QAT'],
    ['06-20', '02:00', 'A', 'MEX', 'KOR'],
    ['06-20', '05:00', 'D', 'USA', 'AUS'],
    ['06-20', '07:30', 'B', 'SCO', 'MAR'],
    ['06-20', '10:00', 'D', 'TUR', 'PAR'],
    ['06-20', '20:00', 'C', 'BRA', 'HAI'],
  ],
  round2: [
    ['06-21', '23:00', 'F', 'NED', 'SWE'],
    ['06-21', '02:00', 'E', 'GER', 'CIV'],
    ['06-21', '05:00', 'E', 'ECU', 'CUW'],
    ['06-21', '11:00', 'G', 'TUN', 'JPN'],
    ['06-22', '23:00', 'H', 'ESP', 'KSA'],
    ['06-22', '02:00', 'H', 'BEL', 'IRN'],
    ['06-22', '05:00', 'G', 'URU', 'CPV'],
    ['06-22', '08:00', 'J', 'NZL', 'EGY'],
    ['06-23', '02:00', 'I', 'ARG', 'AUT'],
    ['06-23', '04:00', 'I', 'FRA', 'IRQ'],
    ['06-23', '07:00', 'J', 'NOR', 'ALG'],
    ['06-23', '10:00', 'K', 'SEN', 'JOR'],
    ['06-24', '02:00', 'L', 'POR', 'GHA'],
    ['06-24', '05:00', 'K', 'ENG', 'UZB'],
    ['06-24', '07:00', 'L', 'CRO', 'PAN'],
    ['06-24', '09:00', 'H', 'COL', 'CGO'],
    ['06-25', '02:00', 'B', 'CZE', 'QAT'],
    ['06-25', '05:00', 'A', 'BIH', 'CAN'],
    ['06-25', '07:00', 'B', 'SUI', 'BRA'],
    ['06-25', '09:00', 'A', 'MAR', 'HAI'],
    ['06-26', '02:00', 'C', 'SCO', 'MEX'],
    ['06-26', '05:00', 'D', 'USA', 'KOR'],
    ['06-26', '07:00', 'D', 'AUS', 'PAR'],
    ['06-26', '09:00', 'C', 'TUR', 'NZL'],
  ],
  round3: [
    // Round 3: ca 2 tran cua cung group da phai cung gio de tranh thoa thuan.
    // Day la best-effort thoi gian; user can confirm trong dashboard.
    ['06-26', '22:00', 'E', 'GER', 'ECU'],
    ['06-26', '22:00', 'E', 'CIV', 'CUW'],
    ['06-27', '02:00', 'F', 'NED', 'IRQ'],
    ['06-27', '02:00', 'F', 'JPN', 'NOR'],
    ['06-27', '06:00', 'G', 'SWE', 'BEL'],
    ['06-27', '06:00', 'G', 'TUN', 'EGY'],
    ['06-27', '10:00', 'H', 'ESP', 'CGO'],
    ['06-27', '10:00', 'H', 'CPV', 'COL'],
    ['06-28', '02:00', 'I', 'KSA', 'SEN'],
    ['06-28', '02:00', 'I', 'URU', 'FRA'],
    ['06-28', '06:00', 'J', 'IRN', 'ALG'],
    ['06-28', '06:00', 'J', 'NZL', 'ARG'],
    ['06-28', '10:00', 'K', 'AUT', 'GHA'],
    ['06-28', '10:00', 'K', 'ENG', 'JOR'],
    ['06-29', '02:00', 'L', 'POR', 'PAN'],
    ['06-29', '02:00', 'L', 'CRO', 'UZB'],
    ['06-29', '06:00', 'B', 'CZE', 'BRA'],
    ['06-29', '06:00', 'B', 'SCO', 'BIH'],
    ['06-29', '10:00', 'A', 'MEX', 'HAI'],
    ['06-29', '10:00', 'A', 'KOR', 'CAN'],
    ['06-30', '02:00', 'C', 'TUR', 'SUI'],
    ['06-30', '02:00', 'C', 'PAR', 'MAR'],
    ['06-30', '06:00', 'D', 'USA', 'AUS'],
    ['06-30', '06:00', 'D', 'IRQ', 'NOR'],
  ],
}

// Parse "MM-DD" + "HH:mm" trong timezone Asia/Saigon -> unix ms UTC.
// SHIFT +1h: lich phat song ban dau bi som hon thuc te 1 tieng (DST USA),
// nen cong them 3600s de match gio kick-off thuc te tai Viet Nam.
function toUtcMs(monthDay, hhmm) {
  const iso = `2026-${monthDay}T${hhmm}:00+07:00`
  const ms = Date.parse(iso)
  if (isNaN(ms)) throw new Error(`Invalid date: ${iso}`)
  return ms + 60 * 60 * 1000
}

function buildRows() {
  const rounds = [['group', SCHEDULE.round1], ['group', SCHEDULE.round2], ['group', SCHEDULE.round3]]
  const rows = []
  for (const [round, list] of rounds) {
    for (const [day, time, group, code1, code2] of list) {
      rows.push({
        day, time, group, code1, code2, round,
        kickOffAt: toUtcMs(day, time),
      })
    }
  }
  return rows
}

// Export rows for API consumption
module.exports = { SCHEDULE, buildRows, toUtcMs }

// CLI mode: chay truc tiep
if (require.main === module) {
  const { initDb } = require('../shared/db')
  const wc = require('../shared/db-worldcup')
  initDb()

  const rows = buildRows()
  console.log(`[Seed] Parsed ${rows.length} group-stage matches`)

  // Map code -> id
  const allTeams = wc.listTeams()
  const codeToId = new Map(allTeams.map(t => [t.code, t.id]))

  const missing = new Set()
  const bulk = []
  for (const r of rows) {
    const t1 = codeToId.get(r.code1)
    const t2 = codeToId.get(r.code2)
    if (!t1) missing.add(r.code1)
    if (!t2) missing.add(r.code2)
    if (t1 && t2) {
      bulk.push({ team1Id: t1, team2Id: t2, kickOffAt: r.kickOffAt, round: r.round, groupName: r.group })
    }
  }

  if (missing.size > 0) {
    console.warn('[Seed] Missing team codes:', [...missing].join(', '))
  }

  const result = wc.bulkCreateMatches(bulk)
  console.log(`[Seed] Inserted: ${result.inserted}, Skipped (duplicates): ${result.skipped}`)
}
