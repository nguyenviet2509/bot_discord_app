// Ed25519 signing cho license payload.
// Private key load tu env 1 lan khi module duoc require.
// Loi khi key khong hop le → crash intentional (fail-fast, khong cho server chay thieu key).

const nacl = require('tweetnacl')
const crypto = require('crypto')

let _sk = null

function getKey() {
  if (_sk) return _sk
  const raw = process.env.LICENSE_ED25519_PRIVATE_KEY
  if (!raw) throw new Error('[license-crypto] LICENSE_ED25519_PRIVATE_KEY chua duoc dat trong .env')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 64) throw new Error('[license-crypto] LICENSE_ED25519_PRIVATE_KEY phai la 64 bytes base64')
  _sk = buf
  return _sk
}

// Canonical payload string: sha256(token)|machine_id|expires_at|issued_at
// Duoc verify phia client bang public key.
function buildCanonical({ token, machine_id, expires_at, issued_at }) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  return `${tokenHash}|${machine_id}|${expires_at || 0}|${issued_at}`
}

// Ky canonical string, tra ve base64 signature (64 bytes)
function sign(canonicalMsg) {
  const sig = nacl.sign.detached(Buffer.from(canonicalMsg, 'utf8'), getKey())
  return Buffer.from(sig).toString('base64')
}

module.exports = { buildCanonical, sign }
