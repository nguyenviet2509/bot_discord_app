// One-time seed: lich thi dau vong bang WC 2026 (parse tu anh lich phat song VTV).
// - Gio kick-off theo timezone Asia/Saigon (UTC+7), convert sang UTC ms khi insert
// - Idempotent: skip neu match da ton tai (same teams + same kickOffAt)
//
// Group composition (xac dinh tu cap dau Round 3):
//   A: CZE, MEX, RSA, KOR
//   B: SUI, BIH, CAN, QAT
//   C: SCO, MAR, BRA, HAI
//   D: USA, AUS, TUR, PAR
//   E: GER, CUW, CIV, ECU
//   F: NED, JPN, SWE, TUN
//   G: BEL, EGY, IRN, NZL
//   H: ESP, CPV, KSA, URU
//   I: FRA, SEN, IRQ, NOR
//   J: AUT, JOR, ALG, ARG
//   K: POR, CGO, UZB, COL
//   L: ENG, CRO, GHA, PAN
//
// LUU Y: 8 tran Round 1 cua bang A-D (host groups) khong co trong anh
// (di ra ngoai range 15-18/06). Dat placeholder 11-14/06, user can chinh
// thoi gian chinh xac qua dashboard.

// Format: [day MM-DD, time HH:MM (Asia/Saigon), group A-L, team1_code, team2_code]
const SCHEDULE = {
  round1: [
    // Bang A-D Round 1: placeholder times (chua co trong anh), user chinh sau
    ['06-11', '06:00', 'A', 'MEX', 'RSA'], // Mexico opener
    ['06-12', '06:00', 'A', 'CZE', 'KOR'],
    ['06-12', '09:00', 'B', 'SUI', 'QAT'],
    ['06-13', '03:00', 'B', 'BIH', 'CAN'],
    ['06-13', '06:00', 'C', 'SCO', 'HAI'],
    ['06-13', '09:00', 'C', 'MAR', 'BRA'],
    ['06-14', '03:00', 'D', 'USA', 'PAR'],
    ['06-14', '06:00', 'D', 'AUS', 'TUR'],
    // Bang E-L Round 1: chinh xac tu anh
    ['06-15', '00:00', 'E', 'GER', 'CUW'],
    ['06-15', '03:00', 'F', 'NED', 'JPN'],
    ['06-15', '06:00', 'E', 'CIV', 'ECU'],
    ['06-15', '09:00', 'F', 'SWE', 'TUN'],
    ['06-15', '23:00', 'H', 'ESP', 'CPV'],
    ['06-16', '02:00', 'G', 'BEL', 'EGY'],
    ['06-16', '05:00', 'H', 'KSA', 'URU'],
    ['06-16', '08:00', 'G', 'IRN', 'NZL'],
    ['06-17', '02:00', 'I', 'FRA', 'SEN'],
    ['06-17', '05:00', 'I', 'IRQ', 'NOR'],
    ['06-17', '08:00', 'J', 'ARG', 'ALG'],
    ['06-17', '11:00', 'J', 'AUT', 'JOR'],
    ['06-18', '00:00', 'K', 'POR', 'CGO'],
    ['06-18', '03:00', 'L', 'ENG', 'CRO'],
    ['06-18', '06:00', 'L', 'GHA', 'PAN'],
    ['06-18', '09:00', 'K', 'UZB', 'COL'],
  ],
  round2: [
    ['06-18', '23:00', 'A', 'CZE', 'RSA'],
    ['06-19', '02:00', 'B', 'SUI', 'BIH'],
    ['06-19', '05:00', 'B', 'CAN', 'QAT'],
    ['06-19', '08:00', 'A', 'MEX', 'KOR'],
    ['06-20', '02:00', 'D', 'USA', 'AUS'],
    ['06-20', '05:00', 'C', 'SCO', 'MAR'],
    ['06-20', '07:30', 'C', 'BRA', 'HAI'],
    ['06-20', '10:00', 'D', 'TUR', 'PAR'],
    ['06-21', '00:00', 'F', 'NED', 'SWE'],
    ['06-21', '03:00', 'E', 'GER', 'CIV'],
    ['06-21', '07:00', 'E', 'ECU', 'CUW'],
    ['06-21', '11:00', 'F', 'TUN', 'JPN'],
    ['06-21', '23:00', 'H', 'ESP', 'KSA'],
    ['06-22', '02:00', 'G', 'BEL', 'IRN'],
    ['06-22', '05:00', 'H', 'URU', 'CPV'],
    ['06-22', '08:00', 'G', 'NZL', 'EGY'],
    ['06-23', '00:00', 'J', 'ARG', 'AUT'],
    ['06-23', '04:00', 'I', 'FRA', 'IRQ'],
    ['06-23', '07:00', 'I', 'NOR', 'SEN'],
    ['06-23', '10:00', 'J', 'JOR', 'ALG'],
    ['06-24', '00:00', 'K', 'POR', 'UZB'],
    ['06-24', '03:00', 'L', 'ENG', 'GHA'],
    ['06-24', '06:00', 'L', 'PAN', 'CRO'],
    ['06-24', '09:00', 'K', 'COL', 'CGO'],
  ],
  round3: [
    // Round 3 vong bang: 2 tran cung group da cung gio
    ['06-25', '02:00', 'B', 'BIH', 'QAT'],
    ['06-25', '02:00', 'B', 'SUI', 'CAN'],
    ['06-25', '05:00', 'C', 'MAR', 'HAI'],
    ['06-25', '05:00', 'C', 'SCO', 'BRA'],
    ['06-25', '08:00', 'A', 'RSA', 'KOR'],
    ['06-25', '08:00', 'A', 'CZE', 'MEX'],
    ['06-26', '03:00', 'E', 'CUW', 'CIV'],
    ['06-26', '03:00', 'E', 'ECU', 'GER'],
    ['06-26', '06:00', 'F', 'TUN', 'NED'],
    ['06-26', '06:00', 'F', 'JPN', 'SWE'],
    ['06-26', '09:00', 'D', 'TUR', 'USA'],
    ['06-26', '09:00', 'D', 'PAR', 'AUS'],
    ['06-27', '02:00', 'I', 'NOR', 'FRA'],
    ['06-27', '02:00', 'I', 'SEN', 'IRQ'],
    ['06-27', '07:00', 'H', 'CPV', 'KSA'],
    ['06-27', '07:00', 'H', 'URU', 'ESP'],
    ['06-27', '10:00', 'G', 'NZL', 'BEL'],
    ['06-27', '10:00', 'G', 'EGY', 'IRN'],
    ['06-28', '04:00', 'L', 'PAN', 'ENG'],
    ['06-28', '04:00', 'L', 'CRO', 'GHA'],
    ['06-28', '06:30', 'K', 'COL', 'POR'],
    ['06-28', '06:30', 'K', 'CGO', 'UZB'],
    ['06-28', '09:00', 'J', 'ALG', 'AUT'],
    ['06-28', '09:00', 'J', 'JOR', 'ARG'],
  ],
  // Vong 1/16 (r32): 16 tran knockout, 32 doi -> 16 doi
  // Parse tu anh lich phat song VTV (29/06 - 04/07)
  round32: [
    ['06-29', '02:00', null, 'RSA', 'CAN'], // Tran 73
    ['06-30', '00:00', null, 'BRA', 'JPN'], // Tran 76
    ['06-30', '03:30', null, 'GER', 'PAR'], // Tran 74
    ['06-30', '08:00', null, 'NED', 'MAR'], // Tran 75
    ['07-01', '00:00', null, 'CIV', 'NOR'], // Tran 78
    ['07-01', '04:00', null, 'FRA', 'SWE'], // Tran 77
    ['07-01', '08:00', null, 'MEX', 'ECU'], // Tran 79
    ['07-01', '23:00', null, 'ENG', 'CGO'], // Tran 80
    ['07-02', '03:00', null, 'BEL', 'SEN'], // Tran 82
    ['07-02', '07:00', null, 'USA', 'BIH'], // Tran 81
    ['07-03', '02:00', null, 'ESP', 'AUT'], // Tran 84
    ['07-03', '06:00', null, 'POR', 'CRO'], // Tran 83
    ['07-03', '10:00', null, 'SUI', 'ALG'], // Tran 85
    ['07-04', '01:00', null, 'AUS', 'EGY'], // Tran 88
    ['07-04', '05:00', null, 'ARG', 'CPV'], // Tran 86
    ['07-04', '08:30', null, 'COL', 'GHA'], // Tran 87
  ],
  // Vong 1/8 (r16): 8 tran knockout, 16 doi -> 8 doi
  // Parse tu anh lich phat song VTV (06/07 - 08/07)
  // LUU Y: anh chi show 6/8 tran (91-96). Tran 89, 90 chua ro thoi gian
  // -> user can bo sung sau qua dashboard hoac cap nhat file nay
  round16: [
    ['07-06', '03:00', null, 'BRA', 'NOR'], // Tran 91
    ['07-06', '08:00', null, 'MEX', 'ENG'], // Tran 92
    ['07-07', '02:00', null, 'POR', 'ESP'], // Tran 93
    ['07-07', '07:00', null, 'USA', 'BEL'], // Tran 94
    ['07-07', '23:00', null, 'ARG', 'EGY'], // Tran 95
    ['07-08', '03:00', null, 'SUI', 'COL'], // Tran 96
  ],
  // Vong tu ket (qf): 4 tran, 8 doi -> 4 doi
  // Parse tu anh lich phat song VTV (10/07 - 12/07)
  quarterFinal: [
    ['07-10', '03:00', null, 'FRA', 'MAR'], // Tran 97
    ['07-11', '02:00', null, 'ESP', 'BEL'], // Tran 98
    ['07-12', '04:00', null, 'NOR', 'ENG'], // Tran 99
    ['07-12', '08:00', null, 'ARG', 'SUI'], // Tran 100
  ],
}

// Parse "MM-DD" + "HH:mm" trong timezone Asia/Saigon -> unix ms UTC
function toUtcMs(monthDay, hhmm) {
  const iso = `2026-${monthDay}T${hhmm}:00+07:00`
  const ms = Date.parse(iso)
  if (isNaN(ms)) throw new Error(`Invalid date: ${iso}`)
  return ms
}

function buildRows() {
  const rounds = [
    ['group', SCHEDULE.round1],
    ['group', SCHEDULE.round2],
    ['group', SCHEDULE.round3],
    ['r32', SCHEDULE.round32],
    ['r16', SCHEDULE.round16],
    ['qf', SCHEDULE.quarterFinal],
  ]
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

module.exports = { SCHEDULE, buildRows, toUtcMs }

// CLI mode
if (require.main === module) {
  const { initDb } = require('../shared/db')
  const wc = require('../shared/db-worldcup')
  initDb()

  const rows = buildRows()
  console.log(`[Seed] Parsed ${rows.length} group-stage matches`)

  const codeToId = new Map(wc.listTeams().map(t => [t.code, t.id]))
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

  if (missing.size > 0) console.warn('[Seed] Missing team codes:', [...missing].join(', '))

  const result = wc.bulkCreateMatches(bulk)
  console.log(`[Seed] Inserted: ${result.inserted}, Skipped (duplicates): ${result.skipped}`)
}
