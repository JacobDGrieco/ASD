/**
 * Core admin authentication and authorization for the ASD admin CMS.
 *
 * This module is the single source of truth for "who is this request from and what
 * are they allowed to touch." It owns the JWT session cookie (issuing, reading,
 * verifying, clearing) and the Prisma `where`-clause builders that scope admin data
 * access by role.
 *
 * Runs server-only (Vercel Functions under `api/`) — it reads `process.env.JWT_SECRET`
 * and constructs Set-Cookie headers, neither of which are meaningful in the browser.
 *
 * Role model: `SUPER_ADMIN` (full access), `ARTIST` (scoped to one `artistId`),
 * `TALENT` (scoped to one `talentId`, fashion side), `VIEWER` (read-mostly, no
 * scoping identifier). See `src/lib/adminPageAccess.js` for which admin pages each
 * role can see, and `api/admin/login.js` for how a session is first created.
 *
 * Main consumers: every handler in `api/admin/*.js` calls `requireAdmin`/
 * `requireSuperAdmin` before doing anything; `api/admin/albums.js` and
 * `api/admin/songs.js` use `artistScopedAlbumWhere`/`artistScopedSongWhere` to filter
 * list queries to what the caller is allowed to see.
 *
 * Security note: session state lives entirely in an HttpOnly cookie. Browser code
 * only keeps a local sentinel so the UI can distinguish "maybe logged in" from
 * "definitely logged out"; that sentinel is never accepted as a request token.
 */
import jwt from 'jsonwebtoken';
import { releaseVisibilityUpperBound } from './releaseSchedule.js';
import { hasAdminPageAccess, normalizeAdminPageAccess } from './adminPageAccess.js';

export const ADMIN_ROLE_SUPER = 'SUPER_ADMIN';
export const ADMIN_ROLE_ARTIST = 'ARTIST';
export const ADMIN_ROLE_TALENT = 'TALENT';
export const ADMIN_ROLE_VIEWER = 'VIEWER';
export const ADMIN_AUTH_COOKIE_NAME = 'asd_admin_token';

function secret() {
	return process.env.JWT_SECRET;
}

// Treat the client-side cookie sentinel, plus string forms of missing values, as
// "no usable bearer token" so accidental legacy headers fall back to the cookie.
function isUsableBearerToken(value) {
	return Boolean(value && value !== 'null' && value !== 'undefined' && value !== 'cookie');
}

function parseCookieHeader(cookieHeader = '') {
	return cookieHeader.split(';').reduce((cookies, part) => {
		const separatorIndex = part.indexOf('=');
		if (separatorIndex === -1) return cookies;
		const key = part.slice(0, separatorIndex).trim();
		const value = part.slice(separatorIndex + 1).trim();
		if (key) cookies[key] = decodeURIComponent(value);
		return cookies;
	}, {});
}

export function serializeAdminAuthCookie(token) {
	const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
	return `${ADMIN_AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${8 * 60 * 60}${secure}`;
}

export function serializeClearAdminAuthCookie() {
	const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
	return `${ADMIN_AUTH_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

/**
 * Extracts the admin session token from an incoming request.
 *
 * Prefers a usable `Authorization: Bearer` header, falling back to the
 * `asd_admin_token` HttpOnly cookie. The current browser client only relies on the
 * cookie path.
 *
 * @param {import('http').IncomingMessage} req - Vercel request object.
 * @returns {string|null} Raw JWT string, or null if no session token is present.
 */
export function readAdminTokenFromRequest(req) {
	const auth = req.headers.authorization;
	if (auth?.startsWith('Bearer ')) {
		const bearerToken = auth.slice(7);
		if (isUsableBearerToken(bearerToken)) return bearerToken;
	}

	return parseCookieHeader(req.headers.cookie)[ADMIN_AUTH_COOKIE_NAME] ?? null;
}

/**
 * Signs an admin session into a JWT, valid for 8 hours (matches the cookie's Max-Age).
 *
 * @param {object} session - Session shape produced by one of the `create*Session`
 *   helpers in `api/admin/login.js` (role, artist/talent identity, pageAccess).
 * @returns {string} Signed JWT to be set as the `asd_admin_token` cookie.
 */
export function signToken(session) {
	return jwt.sign(
		{
			role: session.role,
			artistId: session.artistId ?? null,
			artistSlug: session.artistSlug ?? null,
			artistName: session.artistName ?? null,
			talentId: session.talentId ?? null,
			talentSlug: session.talentSlug ?? null,
			talentName: session.talentName ?? null,
			accountName: session.accountName ?? null,
			pageAccess: normalizeAdminPageAccess(session.pageAccess),
		},
		secret(),
		{ expiresIn: '8h' }
	);
}

/**
 * Verifies and decodes an admin JWT into a session object.
 *
 * Any verification failure (bad signature, expired token, malformed payload) is
 * swallowed and reported as `null` rather than thrown — callers only need to know
 * "valid session or not," and `requireAdmin` turns a null into a 401.
 *
 * @param {string} token - Raw JWT, as returned by `readAdminTokenFromRequest`.
 * @returns {object|null} Decoded session, or null if the token is invalid/expired.
 */
export function verifyToken(token) {
	try {
		const payload = jwt.verify(token, secret());

		return {
			role: payload.role,
			artistId: payload.artistId ?? null,
			artistSlug: payload.artistSlug ?? null,
			artistName: payload.artistName ?? null,
			talentId: payload.talentId ?? null,
			talentSlug: payload.talentSlug ?? null,
			talentName: payload.talentName ?? null,
			accountName: payload.accountName ?? null,
			pageAccess: normalizeAdminPageAccess(payload.pageAccess),
		};
	} catch {
		return null;
	}
}

export function isSuperAdmin(session) {
	return session?.role === ADMIN_ROLE_SUPER;
}

export function isArtistAdmin(session) {
	return session?.role === ADMIN_ROLE_ARTIST && Boolean(session.artistId);
}

export function isTalentAdmin(session) {
	return session?.role === ADMIN_ROLE_TALENT && Boolean(session.talentId);
}

export function isViewer(session) {
	return session?.role === ADMIN_ROLE_VIEWER;
}

export function canAccessAdminPage(session, pageKey) {
	return hasAdminPageAccess(session, pageKey);
}

/**
 * Guards an admin API handler: resolves the caller's session, or writes a 401 and
 * returns null. Callers must check the return value and stop handling the request
 * when it's null (the response has already been sent).
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {object|null} The verified session, or null if unauthenticated.
 */
export function requireAdmin(req, res) {
	const token = readAdminTokenFromRequest(req);
	if (!token) {
		res.status(401).json({ error: 'Unauthorized' });
		return null;
	}

	const session = verifyToken(token);
	if (!session) {
		res.status(401).json({ error: 'Unauthorized' });
		return null;
	}

	return session;
}

/**
 * Like `requireAdmin`, but additionally requires the `SUPER_ADMIN` role, writing a
 * 403 if the caller is authenticated but not a super admin.
 */
export function requireSuperAdmin(req, res) {
	const session = requireAdmin(req, res);
	if (!session) return null;
	if (!isSuperAdmin(session)) {
		res.status(403).json({ error: 'Forbidden' });
		return null;
	}
	return session;
}

export function canAccessArtist(session, artistId) {
	return isSuperAdmin(session) || (isArtistAdmin(session) && session.artistId === artistId);
}

function viewerReleaseDateUpperBound() {
	return releaseVisibilityUpperBound();
}

/**
 * Prisma `where` clause approximating "what a VIEWER-role admin may see" for albums:
 * the same rule the public site uses (visible now, or auto-show-on-release once the
 * release date has passed the America/New_York midnight boundary — see
 * `releaseSchedule.js`), rather than the raw `isVisible` column. This lets the
 * read-only viewer role browse the admin UI without exposing not-yet-released or
 * manually-hidden content.
 */
export function viewerAlbumVisibilityWhere() {
	const upperBound = viewerReleaseDateUpperBound();

	return {
		AND: [
			{
				OR: [
					{ isVisible: true },
					{
						AND: [
							{ isVisible: false },
							{ autoShowOnRelease: true },
							{ releaseDate: { lt: upperBound } },
						],
					},
				],
			},
			{
				releaseDate: {
					lt: upperBound,
				},
			},
		],
	};
}

/**
 * Song equivalent of `viewerAlbumVisibilityWhere`. A song's effective release date
 * can come from its own `SongMeta.releaseDate` or fall back to its album's, and a
 * song is excluded if any of its album placements haven't released yet — this
 * mirrors the public API's song-visibility logic in `api/public.js`.
 */
export function viewerSongVisibilityWhere() {
	const upperBound = viewerReleaseDateUpperBound();

	return {
		AND: [
			{
				OR: [
					{ isVisible: true },
					{
						AND: [
							{ isVisible: false },
							{ autoShowOnRelease: true },
							{
								OR: [
									{ meta: { is: { releaseDate: { lt: upperBound } } } },
									{
										placements: {
											some: {
												album: {
													releaseDate: { lt: upperBound },
												},
											},
										},
									},
								],
							},
						],
					},
				],
			},
			{
				OR: [
					{ meta: { is: null } },
					{ meta: { is: { releaseDate: null } } },
					{ meta: { is: { releaseDate: { lt: upperBound } } } },
				],
			},
			{
				placements: {
					none: {
						album: {
							releaseDate: {
								gte: upperBound,
							},
						},
					},
				},
			},
		],
	};
}

/**
 * Prisma `where` clause scoping an album list/query to what `session` is allowed to
 * access: everything for SUPER_ADMIN, the viewer-visibility rule for VIEWER, only
 * the caller's own artist for ARTIST, and an unmatchable clause (`{ id: '__no_access__' }`)
 * for any other/unrecognized role — a deny-by-default fallback rather than an
 * accidental full-table match.
 */
export function artistScopedAlbumWhere(session) {
	if (isSuperAdmin(session)) return {};
	if (isViewer(session)) return viewerAlbumVisibilityWhere();
	if (!isArtistAdmin(session)) return { id: '__no_access__' };
	return { artistId: session.artistId };
}

/**
 * Song equivalent of `artistScopedAlbumWhere`. For an ARTIST session, a song only
 * matches if *every* one of its album placements belongs to the caller's artist —
 * a song placed on another artist's album is excluded even if it's also placed on
 * the caller's, since partial ownership isn't exposed as edit access.
 */
export function artistScopedSongWhere(session) {
	if (isSuperAdmin(session)) return {};
	if (isViewer(session)) return viewerSongVisibilityWhere();
	if (!isArtistAdmin(session)) return { id: '__no_access__' };

	return {
		AND: [
			{
				placements: {
					some: {
						album: {
							artistId: session.artistId,
						},
					},
				},
			},
			{
				placements: {
					none: {
						album: {
							artistId: {
								not: session.artistId,
							},
						},
					},
				},
			},
		],
	};
}
