// Bad-word filter: phat hien tu trong blacklist (admin them qua dashboard).
// Params: { words: ['word1', 'word2', ...] }

const badWordCache = require('../bad-word-cache')

module.exports = {
  name: 'bad-word',
  defaultParams: { words: [] },
  check(message, params, _state) {
    const words = (params && params.words) || []
    if (!Array.isArray(words) || words.length === 0) return null
    const regex = badWordCache.get(message.guild.id, words)
    if (!regex) return null
    const content = message.content || ''
    const m = content.match(regex)
    if (m) {
      return { violated: true, reason: `Tu cam: "${m[1] || m[0]}"` }
    }
    return null
  },
}
