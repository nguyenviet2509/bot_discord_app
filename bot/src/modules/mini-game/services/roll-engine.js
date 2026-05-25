// Random unique uniform pool [1..SCORE_MAX] cho mini-game ROLL.
// Dung Fisher-Yates partial shuffle + crypto.randomInt -> uniform, audit-proof.

const crypto = require('crypto')

const SCORE_MAX = 100

// Tra ve mang n so unique trong [1..SCORE_MAX], thu tu ngau nhien.
function rollScores(n) {
  if (n < 1 || n > SCORE_MAX) throw new Error(`n phai 1..${SCORE_MAX}`)
  const pool = Array.from({ length: SCORE_MAX }, (_, i) => i + 1)
  for (let i = 0; i < n; i++) {
    const j = i + crypto.randomInt(pool.length - i)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

module.exports = { rollScores, SCORE_MAX }
