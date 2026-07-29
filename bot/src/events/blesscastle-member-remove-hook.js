// BlessCastle: soft-delete sao tich luy khi member roi guild.
// Giu data 7 ngay -> restore neu rejoin, xoa han neu qua 7 ngay (cleanup cron).

const bcDb = require('../../../shared/db-blesscastle')

module.exports = {
  name: 'guildMemberRemove',
  execute(member) {
    try {
      bcDb.softDeleteUser(member.guild.id, member.id)
    } catch (err) {
      console.error('[BlessCastle] soft-delete on leave error:', err.message)
    }
  },
}
