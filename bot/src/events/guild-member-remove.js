const db = require('../../../shared/db')
const voiceStatsDb = require('../../../shared/db-voice-stats')

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const guildId = member.guild.id
    const userId = member.id

    try {
      db.logMemberEvent(guildId, userId, 'leave')
    } catch (err) {
      console.error('[guildMemberRemove] log event fail:', err.message)
    }

    // Auto-remove EXP / level data
    try {
      db.deleteUser(userId, guildId)
    } catch (err) {
      console.error('[guildMemberRemove] delete user fail:', err.message)
    }

    // Auto-remove voice stats
    try {
      voiceStatsDb.deleteVoiceStats(guildId, userId)
    } catch (err) {
      console.error('[guildMemberRemove] delete voice stats fail:', err.message)
    }
  },
}
