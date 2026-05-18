// Cache regex compile cho bad-word filter, per-guild.
// Invalidate khi config update (dashboard goi invalidate(guildId)).
//
// Bad-word list trong params: { words: ['word1', 'word2', ...] }
// Moi tu duoc escape regex special chars roi join bang \b ... \b.

const cache = new Map() // guildId -> { signature, regex }

// Escape regex special chars trong user input.
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Build regex tu list tu cam. Tra ve null neu list rong.
function build(words) {
  const valid = (words || [])
    .map(w => String(w || '').trim())
    .filter(w => w.length > 0 && w.length <= 100) // tranh DOS
  if (valid.length === 0) return null
  const pattern = '\\b(' + valid.map(escapeRegex).join('|') + ')\\b'
  try {
    return new RegExp(pattern, 'iu')
  } catch (_) {
    return null
  }
}

// Tra ve regex compile (cache theo signature de tranh recompile khi config khong doi).
function get(guildId, words) {
  const signature = JSON.stringify(words || [])
  const entry = cache.get(guildId)
  if (entry && entry.signature === signature) return entry.regex
  const regex = build(words)
  cache.set(guildId, { signature, regex })
  return regex
}

function invalidate(guildId) {
  cache.delete(guildId)
}

module.exports = { get, invalidate }
