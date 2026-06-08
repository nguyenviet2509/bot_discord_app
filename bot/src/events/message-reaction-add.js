// Track user_id da tha reaction vao bang reaction_users (forward-only).
// Dung cho filter silent-members tren dashboard.
//
// CHI track user thoa man tieu chi silent candidate:
//   1. Chua tung chat (khong co trong bang users)
//   2. Pass role filter (phai co include_role neu set, khong duoc co exclude_role)
//
// Nguoi da chat hoac co role Whitelisted thi khong can track — ho khong bao gio
// xuat hien trong silent list nen tracking ho lang phi storage.

const db = require('../../../shared/db')

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    try {
      if (user.bot) return
      const guildId = reaction.message.guild?.id || reaction.message.guildId
      if (!guildId) return // DM hoac partial khong co guild → skip

      // Filter 1: bo qua nguoi da tung chat
      if (db.userHasChatted(guildId, user.id)) return

      // Filter 2: ap role filter neu da set
      const { include_role_id, exclude_role_id } = db.getSilentFilterConfig(guildId)
      if (include_role_id || exclude_role_id) {
        const guild = reaction.message.guild
        if (!guild) return
        let member = guild.members.cache.get(user.id)
        if (!member) {
          member = await guild.members.fetch(user.id).catch(() => null)
        }
        if (!member) return // khong fetch duoc → skip an toan
        const roleIds = member.roles.cache.map(r => r.id)
        if (include_role_id && !roleIds.includes(include_role_id)) return
        if (exclude_role_id && roleIds.includes(exclude_role_id)) return
      }

      db.markUserReacted(guildId, user.id)
    } catch (err) {
      console.warn('[messageReactionAdd]', err.message)
    }
  },
}
