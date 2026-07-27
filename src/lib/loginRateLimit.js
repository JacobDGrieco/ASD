/**
 * Small server-side rate limiter for admin login attempts.
 *
 * This is intentionally dependency-free and per runtime instance. It blocks noisy
 * brute-force attempts at the application boundary, while deployment-level edge
 * throttling can still be added later for distributed attack resistance.
 */
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_FAILURES = 8;
const loginFailuresByClient = new Map();

function firstForwardedAddress(value) {
	return String(value ?? '').split(',')[0].trim();
}

function clientKeyFromRequest(req) {
	return firstForwardedAddress(req.headers['x-forwarded-for'])
		|| firstForwardedAddress(req.headers['x-real-ip'])
		|| req.socket?.remoteAddress
		|| 'unknown';
}

function currentBucket(key, nowMs) {
	const existing = loginFailuresByClient.get(key);
	if (existing && existing.resetAtMs > nowMs) return existing;

	const fresh = { count: 0, resetAtMs: nowMs + LOGIN_RATE_LIMIT_WINDOW_MS };
	loginFailuresByClient.set(key, fresh);
	return fresh;
}

function cleanupExpiredBuckets(nowMs) {
	for (const [key, bucket] of loginFailuresByClient.entries()) {
		if (bucket.resetAtMs <= nowMs) loginFailuresByClient.delete(key);
	}
}

export function checkLoginRateLimit(req, nowMs = Date.now()) {
	cleanupExpiredBuckets(nowMs);
	const key = clientKeyFromRequest(req);
	const bucket = currentBucket(key, nowMs);
	const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAtMs - nowMs) / 1000));

	return {
		isLimited: bucket.count >= LOGIN_RATE_LIMIT_MAX_FAILURES,
		retryAfterSeconds,
	};
}

export function recordFailedLoginAttempt(req, nowMs = Date.now()) {
	const key = clientKeyFromRequest(req);
	const bucket = currentBucket(key, nowMs);
	bucket.count += 1;
}

export function clearFailedLoginAttempts(req) {
	loginFailuresByClient.delete(clientKeyFromRequest(req));
}
