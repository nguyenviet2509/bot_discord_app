// Admin CRUD endpoints cho licenses — JWT required (auth middleware o server.js).
// Mounted tai /api/admin/licenses.

const express = require('express')
const dbLic = require('../../shared/db-licenses')

const router = express.Router()

// ---- GET / — list tat ca licenses (token da mask) ----
router.get('/', (req, res) => {
  res.json(dbLic.list())
})

// ---- POST / — tao token moi ----
// Body: { user_label?, expires_days?, expires_at?, note?, discord_user_id?, issued_by_discord_id? }
// Returns plaintext token 1 lan duy nhat.
router.post('/', (req, res) => {
  const { user_label, expires_days, expires_at, note, discord_user_id, issued_by_discord_id } = req.body

  const nowSec = Math.floor(Date.now() / 1000)
  let expiresAtSec = null
  if (expires_at) {
    expiresAtSec = parseInt(expires_at, 10)
    if (!Number.isFinite(expiresAtSec) || expiresAtSec <= 0) {
      return res.status(400).json({ error: 'expires_at phai la unix timestamp hop le' })
    }
    if (expiresAtSec <= nowSec + 60) {
      return res.status(400).json({ error: 'expires_at phai lon hon hien tai' })
    }
  } else if (expires_days) {
    const d = parseInt(expires_days, 10)
    if (!Number.isFinite(d) || d <= 0 || d > 3650) {
      return res.status(400).json({ error: 'expires_days phai trong [1, 3650]' })
    }
    expiresAtSec = Math.floor(Date.now() / 1000) + d * 86400
  }

  if (user_label && String(user_label).length > 128) {
    return res.status(400).json({ error: 'user_label toi da 128 ky tu' })
  }
  if (note && String(note).length > 512) {
    return res.status(400).json({ error: 'note toi da 512 ky tu' })
  }

  try {
    const result = dbLic.createToken({
      user_label: user_label ? String(user_label).trim() : null,
      expires_at: expiresAtSec,
      note: note ? String(note).trim() : null,
      discord_user_id: discord_user_id || null,
      issued_by_discord_id: issued_by_discord_id || null,
    })
    // Tra plaintext token 1 lan
    res.status(201).json({ id: result.id, token: result.token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- PATCH /:id — cap nhat label/expires/note ----
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id khong hop le' })

  const lic = dbLic.getById(id)
  if (!lic) return res.status(404).json({ error: 'License khong ton tai' })

  const { user_label, expires_at, expires_days, note } = req.body
  const patch = {}

  if (user_label !== undefined) {
    if (user_label && String(user_label).length > 128) {
      return res.status(400).json({ error: 'user_label toi da 128 ky tu' })
    }
    patch.user_label = user_label ? String(user_label).trim() : null
  }

  if (expires_at !== undefined) {
    const v = parseInt(expires_at, 10)
    if (expires_at !== null && (!Number.isFinite(v) || v <= 0)) {
      return res.status(400).json({ error: 'expires_at khong hop le' })
    }
    if (expires_at !== null && v <= Math.floor(Date.now() / 1000) + 60) {
      return res.status(400).json({ error: 'expires_at phai lon hon hien tai' })
    }
    patch.expires_at = expires_at === null ? null : v
  } else if (expires_days !== undefined) {
    if (expires_days === null) {
      patch.expires_at = null
    } else {
      const d = parseInt(expires_days, 10)
      if (!Number.isFinite(d) || d <= 0 || d > 3650) {
        return res.status(400).json({ error: 'expires_days phai trong [1, 3650]' })
      }
      patch.expires_at = Math.floor(Date.now() / 1000) + d * 86400
    }
  }

  if (note !== undefined) {
    if (note && String(note).length > 512) {
      return res.status(400).json({ error: 'note toi da 512 ky tu' })
    }
    patch.note = note ? String(note).trim() : null
  }

  dbLic.update(id, patch)
  res.json(dbLic.getById(id))
})

// ---- POST /:id/revoke ----
router.post('/:id/revoke', (req, res) => {
  const id = parseInt(req.params.id, 10)
  const lic = dbLic.getById(id)
  if (!lic) return res.status(404).json({ error: 'License khong ton tai' })
  if (lic.revoked) return res.status(409).json({ error: 'Da bi revoke' })

  dbLic.revoke(id)
  dbLic.recordEvent(id, 'revoked', null, null, { by: req.user?.username || 'admin' })
  res.json({ ok: true })
})

// ---- POST /:id/reset-machine ----
router.post('/:id/reset-machine', (req, res) => {
  const id = parseInt(req.params.id, 10)
  const lic = dbLic.getById(id)
  if (!lic) return res.status(404).json({ error: 'License khong ton tai' })

  dbLic.resetMachine(id)
  dbLic.recordEvent(id, 'reset_machine', null, null, { by: req.user?.username || 'admin', prev_machine: lic.machine_id_short || lic.machine_id?.slice(0, 8) })
  res.json({ ok: true })
})

// ---- GET /:id/events ----
router.get('/:id/events', (req, res) => {
  const id = parseInt(req.params.id, 10)
  const lic = dbLic.getById(id)
  if (!lic) return res.status(404).json({ error: 'License khong ton tai' })
  res.json(dbLic.listEvents(id))
})

module.exports = router
