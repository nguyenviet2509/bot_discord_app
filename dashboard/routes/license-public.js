// Public license endpoints — khong yeu cau JWT.
// Mount TRUOC auth middleware trong server.js.
// Rate-limited 10 req/min/IP (duoc ap dung tu server.js).
//
// POST /api/license/activate  — bind machine lan dau hoac xac nhan lai
// POST /api/license/verify    — kiem tra + tra signed payload, khong bind moi

const express = require('express')
const dbLic = require('../../shared/db-licenses')
const { buildCanonical, sign } = require('../../shared/license-crypto')

const router = express.Router()

const GRACE_HOURS = parseInt(process.env.LICENSE_GRACE_HOURS || '48', 10)

// ---- Validation helpers ----

const HEX64_RE = /^[0-9a-f]{64}$/i  // machine_id = 64 hex chars (SHA-256 of hw fingerprint)
const TOKEN_RE = /^[0-9a-f]{32}$/i  // token = 32 hex chars

function validateBody(body) {
  const { token, machine_id, machine_id_short, app_version } = body
  if (!token || !TOKEN_RE.test(token)) return 'token phai la 32 ky tu hex'
  if (!machine_id || !HEX64_RE.test(machine_id)) return 'machine_id phai la 64 ky tu hex'
  if (machine_id_short !== undefined && machine_id_short !== null) {
    if (typeof machine_id_short !== 'string' || machine_id_short.length > 32) {
      return 'machine_id_short toi da 32 ky tu'
    }
    // Cross-check: machine_id_short phai khop 8 ky tu dau cua machine_id
    if (machine_id_short !== machine_id.slice(0, 8)) {
      return 'machine_id_short khong khop machine_id'
    }
  }
  if (app_version !== undefined && app_version !== null) {
    if (typeof app_version !== 'string' || app_version.length > 32) {
      return 'app_version toi da 32 ky tu'
    }
  }
  return null
}

// Kiem tra license co bi expired chua (co grace period)
function isExpired(lic) {
  if (!lic.expires_at) return false
  const graceEnd = lic.expires_at + GRACE_HOURS * 3600
  return Math.floor(Date.now() / 1000) > graceEnd
}

function isHardExpired(lic) {
  if (!lic.expires_at) return false
  return Math.floor(Date.now() / 1000) > lic.expires_at
}

// Xay dung response thanh cong
function buildOkResponse(lic) {
  // issued_at luon lay activated_at (da set sau khi bind) — khong dung Date.now() de on dinh
  const issued_at = lic.activated_at || Math.floor(Date.now() / 1000)
  const canonical = buildCanonical({
    token: lic.token,
    machine_id: lic.machine_id,
    expires_at: lic.expires_at,
    issued_at,
  })
  const signed = sign(canonical)
  return {
    ok: true,
    expires_at: lic.expires_at || null,
    grace_hours: GRACE_HOURS,
    payload: canonical,
    signed,
  }
}

// Su dung req.ip (Express tinh toan theo trust proxy setting — khong doc XFF thu cong)
function clientIp(req) {
  return req.ip || null
}

// ---- Shared validate-and-load helper ----
// Returns { lic } on success, or sends error response and returns null.
// Does NOT bind machine. Caller decides activate vs verify logic.
function validateAndLoad(req, res, token, machine_id) {
  const ip = clientIp(req)
  const ua = req.headers['user-agent'] || null

  const lic = dbLic.findByToken(token)
  if (!lic) {
    res.status(404).json({ error: 'INVALID_TOKEN' })
    return null
  }

  if (lic.revoked) {
    dbLic.recordEvent(lic.id, 'activate_reject', ip, ua, { reason: 'revoked' })
    res.status(410).json({ error: 'REVOKED' })
    return null
  }

  if (isExpired(lic)) {
    dbLic.recordEvent(lic.id, 'activate_reject', ip, ua, { reason: 'expired' })
    res.status(410).json({ error: 'EXPIRED' })
    return null
  }

  return { lic, ip, ua }
}

// ---- POST /activate ----
router.post('/activate', (req, res) => {
  const err = validateBody(req.body)
  if (err) return res.status(400).json({ error: 'INVALID_INPUT', detail: err })

  const { token, machine_id, machine_id_short, app_version } = req.body
  // Derive server-side short to prevent client lying (also validated in validateBody)
  const shortId = machine_id.slice(0, 8)

  const loaded = validateAndLoad(req, res, token, machine_id)
  if (!loaded) return
  const { lic, ip, ua } = loaded

  // Chua bind machine → atomic conditional bind (tranh race condition 2 request dong thoi)
  if (!lic.machine_id) {
    const changes = dbLic.bindMachine(lic.id, machine_id, shortId, ip, ua, app_version || null)
    if (changes === 0) {
      // Race lost: another request bound first — re-fetch to check who won
      const fresh = dbLic.getById(lic.id)
      if (fresh.machine_id && fresh.machine_id !== machine_id) {
        dbLic.recordEvent(lic.id, 'activate_reject', ip, ua, { reason: 'machine_mismatch', incoming_short: shortId })
        return res.status(409).json({ error: 'MACHINE_MISMATCH' })
      }
      // Same machine won the race (concurrent retry) — fall through to success
      const updated2 = dbLic.getById(lic.id)
      dbLic.recordEvent(lic.id, 'activate', ip, ua, { machine_id_short: shortId, app_version: app_version || null })
      return res.json(buildOkResponse(updated2))
    }
    const updated = dbLic.getById(lic.id)
    dbLic.recordEvent(lic.id, 'activate', ip, ua, { machine_id_short: shortId, app_version: app_version || null })
    return res.json(buildOkResponse(updated))
  }

  // Da bind → kiem tra machine_id khop
  if (lic.machine_id !== machine_id) {
    dbLic.recordEvent(lic.id, 'activate_reject', ip, ua, { reason: 'machine_mismatch', incoming_short: shortId })
    return res.status(409).json({ error: 'MACHINE_MISMATCH' })
  }

  // Khop → cap nhat last_seen
  dbLic.touchSeen(lic.id, ip, app_version || null)
  const updated = dbLic.getById(lic.id)
  dbLic.recordEvent(lic.id, 'activate', ip, ua, { app_version: app_version || null })
  return res.json(buildOkResponse(updated))
})

// ---- POST /verify ----
// Khac activate: khong bind machine moi, mismatch luon → 409
router.post('/verify', (req, res) => {
  const err = validateBody(req.body)
  if (err) return res.status(400).json({ error: 'INVALID_INPUT', detail: err })

  const { token, machine_id, app_version } = req.body

  const loaded = validateAndLoad(req, res, token, machine_id)
  if (!loaded) return
  const { lic, ip, ua } = loaded

  // Soft expiry: bao cao nhung van cho qua trong grace period
  const hardExp = isHardExpired(lic)
  // isExpired da duoc kiem tra trong validateAndLoad, nhung verify dung softExp rieng
  const softExp = isExpired(lic)
  if (softExp) {
    dbLic.recordEvent(lic.id, 'verify_reject', ip, ua, { reason: 'expired' })
    return res.status(410).json({ error: 'EXPIRED' })
  }

  if (!lic.machine_id || lic.machine_id !== machine_id) {
    dbLic.recordEvent(lic.id, 'verify_reject', ip, ua, { reason: 'machine_mismatch' })
    return res.status(409).json({ error: 'MACHINE_MISMATCH' })
  }

  dbLic.touchSeen(lic.id, ip, app_version || null)
  const updated = dbLic.getById(lic.id)
  dbLic.recordEvent(lic.id, 'verify', ip, ua, { app_version: app_version || null, grace: hardExp })
  return res.json({ ...buildOkResponse(updated), grace: hardExp })
})

module.exports = router
