// AES-256-GCM encrypt/decrypt cho Discord bot token luu trong DB.
// Key lay tu env BOT_TOKEN_ENCRYPTION_KEY (64 ky tu hex = 32 bytes).
// Output format: ciphertext = base64(encrypted || authTag) — 16 bytes cuoi la authTag.

const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12 // GCM standard
const TAG_BYTES = 16

function getKey() {
  const hex = process.env.BOT_TOKEN_ENCRYPTION_KEY
  if (!hex) {
    throw new Error('BOT_TOKEN_ENCRYPTION_KEY chua duoc dat trong .env')
  }
  if (hex.length !== KEY_BYTES * 2) {
    throw new Error(`BOT_TOKEN_ENCRYPTION_KEY phai dai ${KEY_BYTES * 2} ky tu hex (32 bytes)`)
  }
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== KEY_BYTES) {
    throw new Error('BOT_TOKEN_ENCRYPTION_KEY khong phai hex hop le')
  }
  return buf
}

function encrypt(plaintext) {
  const key = getKey()
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString('base64'),
    iv: iv.toString('base64'),
  }
}

function decrypt(ciphertextB64, ivB64) {
  const key = getKey()
  const iv = Buffer.from(ivB64, 'base64')
  const data = Buffer.from(ciphertextB64, 'base64')
  if (data.length < TAG_BYTES) {
    throw new Error('Ciphertext qua ngan, thieu auth tag')
  }
  const encrypted = data.subarray(0, data.length - TAG_BYTES)
  const tag = data.subarray(data.length - TAG_BYTES)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

// Mask token cho frontend: hien 4 ky tu dau + 4 cuoi
function maskToken(plaintext) {
  if (!plaintext || plaintext.length < 10) return '***'
  return `${plaintext.slice(0, 4)}...${plaintext.slice(-4)}`
}

module.exports = { encrypt, decrypt, maskToken }
