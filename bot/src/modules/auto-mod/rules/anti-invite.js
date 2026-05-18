// Anti-invite: phat hien link moi server Discord.

const INVITE_REGEX = /(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)([a-zA-Z0-9-]{2,32})/i

module.exports = {
  name: 'anti-invite',
  defaultParams: {},
  check(message, _params, _state) {
    const content = message.content || ''
    const m = content.match(INVITE_REGEX)
    if (m) {
      return { violated: true, reason: `Link moi server: ${m[0]}` }
    }
    return null
  },
}
