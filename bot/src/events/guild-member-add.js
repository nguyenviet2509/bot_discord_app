const db = require('../../../shared/db')

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      db.logMemberEvent(member.guild.id, member.id, 'join')
    } catch (err) {
      console.error('[guildMemberAdd] log fail:', err.message)
    }
  },
}
