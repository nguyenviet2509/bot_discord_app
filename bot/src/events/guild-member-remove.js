const db = require('../../../shared/db')

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    try {
      db.logMemberEvent(member.guild.id, member.id, 'leave')
    } catch (err) {
      console.error('[guildMemberRemove] log fail:', err.message)
    }
  },
}
