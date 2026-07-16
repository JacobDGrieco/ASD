/**
 * Handles two "reserved" pseudo-artists that must never appear as browsable artist
 * pages, plus the path-building helpers that respect per-item public visibility.
 *
 * - `Other` (`OTHER_ARTIST_*`): a placeholder artist used for compilation/various-
 *   artist albums (see `otherArtistName` override in `api/public.js`'s
 *   `applyPublicArtistName`).
 * - `A.S.D.` (`ASD_RECORDS_ARTIST_*`): the label's own "house" artist row, which
 *   doubles as a super-admin account (see `isAsdRecordsArtist` usage in
 *   `api/admin/login.js`) and so must stay hidden from the public artist list.
 *
 * Runs in both server (`api/public.js` visibility filters) and client
 * (`buildAlbumPath`/`buildSongPath` used by page/link components) contexts.
 */
export const OTHER_ARTIST_NAME = 'Other';
export const OTHER_ARTIST_SLUG = 'other';
export const OTHER_ARTIST_OPTION_ID = '__other__';
export const ASD_RECORDS_ARTIST_NAME = 'A.S.D.';
export const ASD_RECORDS_ARTIST_SLUG = 'asd-records';
export const ASD_RECORDS_ARTIST_OPTION_ID = '__asd_records__';

function normalizeValue(value) {
	return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isOtherArtist(value) {
	if (!value) return false;

	if (typeof value === 'string') {
		const normalized = normalizeValue(value);
		return normalized === OTHER_ARTIST_NAME.toLowerCase() || normalized === OTHER_ARTIST_SLUG;
	}

	return (
		normalizeValue(value.slug) === OTHER_ARTIST_SLUG ||
		normalizeValue(value.name) === OTHER_ARTIST_NAME.toLowerCase()
	);
}

export function isAsdRecordsArtist(value) {
	if (!value) return false;

	if (typeof value === 'string') {
		const normalized = normalizeValue(value);
		return normalized === ASD_RECORDS_ARTIST_NAME.toLowerCase() || normalized === ASD_RECORDS_ARTIST_SLUG;
	}

	return (
		normalizeValue(value.slug) === ASD_RECORDS_ARTIST_SLUG ||
		normalizeValue(value.name) === ASD_RECORDS_ARTIST_NAME.toLowerCase()
	);
}

/** True for either reserved pseudo-artist — used to exclude both from public listings. */
export function isReservedHiddenArtist(value) {
	return isOtherArtist(value) || isAsdRecordsArtist(value);
}

/** Whether a board post's artist should be allowed to surface on the public board. */
export function hasPublicBoardSource(value) {
	if (!value) return false;
	if (typeof value === 'object' && value.isVisible === false) return false;
	if (isOtherArtist(value)) return false;
	return true;
}

/**
 * Builds a song's public path, returning null (rather than a dead link) when the
 * song isn't publicly visible — callers use this to conditionally render a link
 * vs. plain text. Pass `allowHidden: true` from admin-preview contexts that need
 * the path regardless of visibility.
 */
export function buildSongPath({ song, allowHidden = false }) {
	if (!song?.id) return null;
	if (!allowHidden && song.isPubliclyVisible === false) return null;
	return `/songs/${song.id}`;
}

/** Album equivalent of `buildSongPath`. */
export function buildAlbumPath({ album, allowHidden = false }) {
	if (!album?.id) return null;
	if (!allowHidden && album.isPubliclyVisible === false) return null;
	return `/albums/${album.id}`;
}
