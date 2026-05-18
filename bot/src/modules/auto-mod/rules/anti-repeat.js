// Anti-repeat: vi pham khi gui CUNG noi dung lien tiep >= maxRepeats lan.
// Noi dung duoc normalize (trim + lowercase) de tranh lach kieu "Hi" vs "hi  ".

const DEFAULTS = { maxRepeats: 3 }

function normalize(s) {
  return String(s || '').trim().toLowerCase()
}

module.exports = {
  name: 'anti-repeat',
  defaultParams: DEFAULTS,
  check(message, params, state) {
    const p = { ...DEFAULTS, ...(params || {}) }
    const content = normalize(message.content)
    if (!content) return null
    const key = `${message.guild.id}:${message.author.id}`
    const count = state.repeat.push(key, content, Date.now())
    if (count >= p.maxRepeats) {
      return { violated: true, reason: `Lap noi dung ${count} lan` }
    }
    return null
  },
}
