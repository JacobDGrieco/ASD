/**
 * React context/provider for the admin session — the client-side counterpart to
 * `src/lib/auth.js`. Owns login/logout and re-hydrates the session from the
 * `asd_admin_token` cookie on mount via `GET /api/admin/login`. Client-only.
 *
 * Consumed by `App.jsx` (wraps the whole app in `AdminProvider`), every admin page/
 * component via `useAdminAuth()`, and indirectly by public pages that show
 * admin-only affordances while browsing the live site (`BoardPage.jsx`,
 * `FashionHomePage.jsx`).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { clearAdminResourceCache } from './adminResourceCache.js';

const AdminContext = createContext(null);
const ADMIN_SESSION_MARKER_KEY = 'asd_admin_session_seen';
// Real auth is the HttpOnly session cookie (see src/lib/auth.js); this sentinel only
// signals "a session exists" to consumers. Many admin pages still build an
// `Authorization: Bearer ${token}` header from it out of habit — the server discards
// that header (see isUsableBearerToken in src/lib/auth.js) and falls back to the
// cookie, so those headers are inert. TODO: sweep the remaining admin pages/components
// (AdminSongFormModal, AdminMusicLyricsPage, AdminMusicBoardPage, AdminMusicCrosshairPage,
// AdminAboutPage, AdminAccountsPage, AdminMusicAlbumsPage, AdminMusicArtistsPage,
// AdminFashionTalentPage, AdminFashionLooksPage, AdminFashionCollectionsPage,
// AdminFashionOutsideTalentPage, AdminMusicOutsideArtistsPage, AdminMusicSongsPage,
// AdminMusicRecordPlayerPage, FashionHomePage, BoardPage, ImageCollectionField,
// BoardMarkdownEditor) to drop this dead header construction. Left in place for now —
// flagged for a dedicated follow-up pass rather than a blind mechanical rewrite.
const COOKIE_AUTH_SENTINEL = 'cookie';

function hasAdminSessionMarker() {
	try {
		return window.localStorage.getItem(ADMIN_SESSION_MARKER_KEY) === '1';
	} catch {
		return false;
	}
}

function setAdminSessionMarker() {
	try {
		window.localStorage.setItem(ADMIN_SESSION_MARKER_KEY, '1');
	} catch {
		// Ignore storage failures; the HttpOnly cookie remains the auth source.
	}
}

function clearAdminSessionMarker() {
	try {
		window.localStorage.removeItem(ADMIN_SESSION_MARKER_KEY);
	} catch {
		// Ignore storage failures; logout still clears the server cookie.
	}
}

/**
 * Provides `{ token, session, loading, login, logout }` to the app. On mount,
 * checks for an existing cookie session; `login`/`logout` call the corresponding
 * `api/admin/login` endpoint and clear the admin resource cache so stale data from
 * a previous session/account doesn't leak into the next one.
 */
export function AdminProvider({ children }) {
	const location = useLocation();
	const [token, setToken] = useState(null);
	const [session, setSession] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let ignore = false;
		const isAdminLoginRoute = location.pathname === '/admin/login';
		const isProtectedAdminRoute = !isAdminLoginRoute && (
			location.pathname === '/admin' || location.pathname.startsWith('/admin/')
		);

		if (!isProtectedAdminRoute && !hasAdminSessionMarker()) {
			setLoading(false);
			return undefined;
		}

		fetch('/api/admin/login')
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (ignore) return;
				if (data?.session) {
					setAdminSessionMarker();
					setToken(COOKIE_AUTH_SENTINEL);
					setSession(data.session);
				} else {
					clearAdminSessionMarker();
					setToken(null);
					setSession(null);
				}
			})
			.finally(() => {
				if (!ignore) setLoading(false);
			});

		return () => {
			ignore = true;
		};
	}, [location.pathname]);

	const login = useCallback(async (password) => {
		clearAdminResourceCache();
		const res = await fetch('/api/admin/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password }),
		});
		if (!res.ok) throw new Error('Invalid password');

		const data = await res.json();
		setAdminSessionMarker();
		setToken(COOKIE_AUTH_SENTINEL);
		setSession(data.session);
	}, []);

	const logout = useCallback(async () => {
		await fetch('/api/admin/login', { method: 'DELETE' }).catch(() => { });
		clearAdminResourceCache();
		clearAdminSessionMarker();
		setToken(null);
		setSession(null);
	}, []);

	const value = useMemo(() => ({ token, session, loading, login, logout }), [loading, login, logout, session, token]);

	return (
		<AdminContext.Provider value={value}>
			{children}
		</AdminContext.Provider>
	);
}

/** Reads the current admin session context; returns null outside an `AdminProvider`. */
export function useAdminAuth() {
	return useContext(AdminContext);
}
