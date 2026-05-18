// Anti-spam (flood): vi pham khi gui >= maxMessages tin trong windowSec giay.

const DEFAULTS = { maxMessages: 5, windowSec: 5 }

module.exports = {
  name: 'anti-spam',
  defaultParams: DEFAULTS,
  check(message, params, state) {
    const p = { ...DEFAULTS, ...(params || {}) }
    const key = `${message.guild.id}:${message.author.id}`
    const hits = state.flood.push(key, Date.now(), p.windowSec * 1000)
    if (hits >= p.maxMessages) {
      return { violated: true, reason: `${hits} tin trong ${p.windowSec}s` }
    }
    return null
  },
}
