// Rules engine: chay pipeline rules da enable, early-exit khi co vi pham.
// Tra ve { rule, reason } neu vi pham, null neu OK.

const antiSpam = require('./rules/anti-spam')
const antiInvite = require('./rules/anti-invite')
const badWord = require('./rules/bad-word')
const antiMassMention = require('./rules/anti-mass-mention')
const antiRepeat = require('./rules/anti-repeat')

// Thu tu chay rules (rule cheap truoc, rule co state sau).
// anti-invite, bad-word, mass-mention la stateless -> chay truoc.
// anti-spam, anti-repeat co side effect (push state) -> chay sau.
const RULES = [
  antiInvite,
  badWord,
  antiMassMention,
  antiSpam,
  antiRepeat,
]

// config = { 'anti-spam': {enabled, params}, ... }
function runRules(message, config, state) {
  for (const rule of RULES) {
    const cfg = config[rule.name]
    if (!cfg || !cfg.enabled) continue
    try {
      const result = rule.check(message, cfg.params, state)
      if (result && result.violated) {
        return { rule: rule.name, reason: result.reason }
      }
    } catch (err) {
      console.error(`[auto-mod] rule ${rule.name} loi:`, err.message)
    }
  }
  return null
}

module.exports = { runRules, RULES }
