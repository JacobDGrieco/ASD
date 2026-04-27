import crypto from 'node:crypto'

const HASH_ALGORITHM = 'scrypt'
const SCRYPT_KEYLEN = 64

function randomSalt() {
  return crypto.randomBytes(16).toString('hex')
}

function deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, SCRYPT_KEYLEN)
}

export function hashPassword(password) {
  const salt = randomSalt()
  const hash = deriveKey(password, salt).toString('hex')
  return `${HASH_ALGORITHM}:${salt}:${hash}`
}

export function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false

  const [algorithm, salt, hashHex] = String(storedHash).split(':')
  if (algorithm !== HASH_ALGORITHM || !salt || !hashHex) return false

  const derived = deriveKey(password, salt)
  const stored = Buffer.from(hashHex, 'hex')
  if (stored.length !== derived.length) return false

  return crypto.timingSafeEqual(derived, stored)
}
