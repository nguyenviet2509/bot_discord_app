// Track user_id da tha reaction vao bang reaction_users (forward-only).
// Dung cho filter silent-members tren dashboard: loai member da tuong tac qua reaction
// du chua chat lan nao.
//
// Partial: reaction tren tin nhan cu (truoc khi bot online) co the la partial.
// Khong can fetch full data — chi can user.id va guild.id.

const db = require('../../../shared/db')

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    try {
      if (user.bot) return
      const guildId = reaction.message.guild?.id || reaction.message.guildId
      if (!guildId) return // DM hoac partial khong co guild → skip
      db.markUserReacted(guildId, user.id)
    } catch (err) {
      console.warn('[messageReactionAdd]', err.message)
    }
  },
}
