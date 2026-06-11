// Tao cap khoa Ed25519 cho license signing.
// Chay 1 lan: node tools/license-keygen.js
// Copy private key vao .env, public key vao src/license/server-public-key.h (phase 3)

const nacl = require('tweetnacl')

const pair = nacl.sign.keyPair()

const privB64 = Buffer.from(pair.secretKey).toString('base64')
const pubB64 = Buffer.from(pair.publicKey).toString('base64')

const hexBytes = Array.from(pair.publicKey)
  .map((b) => '0x' + b.toString(16).padStart(2, '0').toUpperCase())
  .join(', ')

console.log('=== Add to .env ===')
console.log(`LICENSE_ED25519_PRIVATE_KEY=${privB64}`)
console.log(`LICENSE_ED25519_PUBLIC_KEY_B64=${pubB64}`)
console.log()
console.log('=== C++ header (paste into src/license/server-public-key.h) ===')
console.log('#pragma once')
console.log('constexpr unsigned char kServerPubKey[32] = {')
console.log(`    ${hexBytes}`)
console.log('};')
