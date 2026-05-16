// Pure function judge cho Keo-Bua-Bao. Khong phu thuoc Discord.
// Pick values: 'scissors' | 'rock' | 'paper'.

const VALID = ['scissors', 'rock', 'paper']

const LABEL = {
  scissors: { vi: 'Kéo', emoji: '✂️' },
  rock:     { vi: 'Búa', emoji: '🪨' },
  paper:    { vi: 'Bao', emoji: '📄' },
}

// Tra ve 'a' | 'b' | 'draw'.
// pickA, pickB phai la chuoi hop le.
function judge(pickA, pickB) {
  if (!VALID.includes(pickA) || !VALID.includes(pickB)) {
    throw new Error(`Pick khong hop le: ${pickA}, ${pickB}`)
  }
  if (pickA === pickB) return 'draw'
  const winsAgainst = { scissors: 'paper', rock: 'scissors', paper: 'rock' }
  return winsAgainst[pickA] === pickB ? 'a' : 'b'
}

module.exports = { VALID, LABEL, judge }
