/**
 * Password hashing for DB-backed admin accounts (`ArtistAdminAccess`,
 * `FashionTalentAdminAccess`). Uses Node's built-in `scrypt` rather than a
 * dedicated password-hashing library — stored as `scrypt:<hexSalt>:<hexHash>` so
 * the algorithm is versioned into the value itself. Server-only.
 */
import crypto from 'node:crypto';

const HASH_ALGORITHM = 'scrypt';
const SCRYPT_KEYLEN = 64;

function randomSalt() {
	return crypto.randomBytes(16).toString('hex');
}

function deriveKey(password, salt) {
	return crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
}

/** Hashes `password` with a fresh random salt, returning the storable `scrypt:salt:hash` string. */
export function hashPassword(password) {
	const salt = randomSalt();
	const hash = deriveKey(password, salt).toString('hex');
	return `${HASH_ALGORITHM}:${salt}:${hash}`;
}

/**
 * Verifies `password` against a stored `hashPassword` output using a constant-time
 * comparison (`timingSafeEqual`), so a failed check doesn't leak timing information
 * about how much of the hash matched.
 */
export function verifyPassword(password, storedHash) {
	if (!password || !storedHash) return false;

	const [algorithm, salt, hashHex] = String(storedHash).split(':');
	if (algorithm !== HASH_ALGORITHM || !salt || !hashHex) return false;

	const derived = deriveKey(password, salt);
	const stored = Buffer.from(hashHex, 'hex');
	if (stored.length !== derived.length) return false;

	return crypto.timingSafeEqual(derived, stored);
}
