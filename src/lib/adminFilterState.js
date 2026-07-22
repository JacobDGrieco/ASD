/**
 * Small persistence helper for admin list filters.
 *
 * Filter values are stored in browser session storage so admins can move between
 * edit screens without losing their current list/search context.
 */
export const ADMIN_ALBUMS_FILTER_STATE_KEY = 'admin-albums-page-state';
export const ADMIN_SONGS_FILTER_STATE_KEY = 'admin-songs-page-state';

const ADMIN_FILTER_STATE_KEYS = [
	ADMIN_ALBUMS_FILTER_STATE_KEY,
	ADMIN_SONGS_FILTER_STATE_KEY,
];

export function clearAdminFilterState() {
	if (typeof window === 'undefined') return;
	for (const key of ADMIN_FILTER_STATE_KEYS) {
		window.sessionStorage.removeItem(key);
	}
}
