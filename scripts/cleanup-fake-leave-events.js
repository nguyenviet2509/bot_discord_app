// Script chay 1 lan: xoa cac 'leave' event GIA do reconcile ghost-users tao ra
// (trong commit 6cfefb6 - 5eafacc). Reconcile vo tinh log leave voi occurred_at=NOW
// gay spike sai trong chart "Tang truong member".
//
// Cach dung:
//   node scripts/cleanup-fake-leave-events.js
//
// Script in ra so event se xoa va yeu cau confirm bang flag --yes:
//   node scripts/cleanup-fake-leave-events.js --yes

const path = require('path')
const Database = require('better-sqlite3')

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..')
const DB_PATH = path.join(DATA_DIR, 'database.sqlite')
const CONFIRM = process.argv.includes('--yes')

const db = new Database(DB_PATH)

// Heuristic: cac fake leave events duoc tao do reconcile khi user mo dashboard
// SAU khi deploy commit 6cfefb6 (~18/06/2026 sang). Cac leave event truoc do hop le.
// Cutoff: occurred_at >= 2026-06-18 00:00 (Asia/Saigon = UTC+7 = 2026-06-17 17:00 UTC).
const CUTOFF_UNIX = Math.floor(new Date('2026-06-17T17:00:00Z').getTime() / 1000)

const count = db
  .prepare("SELECT COUNT(*) as n FROM member_events WHERE event_type = 'leave' AND occurred_at >= ?")
  .get(CUTOFF_UNIX).n

console.log(`Tim thay ${count} 'leave' events tu ${new Date(CUTOFF_UNIX * 1000).toISOString()} tro di.`)

if (count === 0) {
  console.log('Khong co gi can xoa.')
  process.exit(0)
}

if (!CONFIRM) {
  console.log('Chay lai voi --yes de xoa thuc su.')
  process.exit(0)
}

const result = db
  .prepare("DELETE FROM member_events WHERE event_type = 'leave' AND occurred_at >= ?")
  .run(CUTOFF_UNIX)

console.log(`Da xoa ${result.changes} events.`)
db.close()
