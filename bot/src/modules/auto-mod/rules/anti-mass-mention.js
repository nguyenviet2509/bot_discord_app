// Anti-mass-mention: vi pham khi tong so mention (user + role) trong 1 tin > maxMentions.
// Dung message.mentions cua discord.js de tranh false positive tu regex `<@...`.

const DEFAULTS = { maxMentions: 5 }

module.exports = {
  name: 'anti-mass-mention',
  defaultParams: DEFAULTS,
  check(message, params, _state) {
    const p = { ...DEFAULTS, ...(params || {}) }
    const users = (message.mentions && message.mentions.users && message.mentions.users.size) || 0
    const roles = (message.mentions && message.mentions.roles && message.mentions.roles.size) || 0
    const total = users + roles
    if (total > p.maxMentions) {
      return { violated: true, reason: `${total} mention trong 1 tin` }
    }
    return null
  },
}
