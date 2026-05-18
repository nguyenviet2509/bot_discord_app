// Register module Auto-Mod Lite: dang ky message handler vao client._moduleMessageHandlers.
// Handler chi detect vi pham va danh dau vao message._automodViolation.
// Action engine se duoc goi tu event message-create (phase 3).

const dbAutomod = require('../../../../shared/db-automod')
const dbMiniGame = require('../../../../shared/db-mini-game')
const { runRules } = require('./rules-engine')
const state = require('./state')

module.exports = function register(client, ctx) {
  ctx.messageHandlers.push(async (message) => {
    try {
      if (!message.guild || message.author.bot) return false

      // Module phai duoc bat per-guild qua dashboard
      if (!dbMiniGame.isModuleEnabled(message.guild.id, ctx.manifest.key)) return false

      // Whitelist channel/role - short-circuit som
      const roleIds = (message.member && message.member.roles && message.member.roles.cache)
        ? Array.from(message.member.roles.cache.keys())
        : []
      if (dbAutomod.isWhitelisted(message.guild.id, message.channel.id, roleIds)) return false

      const config = dbAutomod.getConfig(message.guild.id)
      if (!config || Object.keys(config).length === 0) return false

      const result = runRules(message, config, state)
      if (result) {
        // Danh dau de event message-create goi action engine
        message._automodViolation = result
      }
    } catch (err) {
      console.error('[auto-mod] handler loi:', err.message)
    }
    return false
  })
}
