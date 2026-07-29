// BlessCastle: restore sao tich luy khi member rejoin trong 7 ngay.

const bcDb = require('../../../shared/db-blesscastle')

const SEVEN_DAYS_SEC = 7 * 86400

module.exports = {
  name: 'guildMemberAdd',
  execute(member) {
    try {
      const row = bcDb.getStarsRow(member.guild.id, member.id)
      if (!row || !row.deleted_at) return
      const nowSec = Math.floor(Date.now() / 1000)
      if (nowSec - row.deleted_at <= SEVEN_DAYS_SEC) {
        bcDb.restoreUser(member.guild.id, member.id)
        console.log(`[BlessCastle] Restored user ${member.id} in guild ${member.guild.id} (rejoined within 7 days)`)
      }
    } catch (err) {
      console.error('[BlessCastle] restore on rejoin error:', err.message)
    }
  },
}
