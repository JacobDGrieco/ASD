/**
 * Decides whether a song should show its own streaming links, or fall back to its
 * parent album's links. Business rule: a song only gets independent links when it's
 * placed on a multi-track release (`ALBUM`/`EP`) — on a `SINGLE`, the song and album
 * are effectively the same release, so the song reuses the album's links rather
 * than needing its own copy re-entered. See `publicSongReleaseSource` in
 * `api/public.js` for where this decides which record's links to serve.
 */
const SONG_OWN_LINK_ALBUM_TYPES = new Set(['ALBUM', 'EP']);
const SONG_SHARED_RELEASE_FIELD_ALBUM_TYPES = new Set(['SINGLE']);

/** Whether `type` (an Album's `type` field) is a release type where songs carry their own links. */
export function albumTypeAllowsSongLinks(type) {
	return SONG_OWN_LINK_ALBUM_TYPES.has(String(type ?? '').toUpperCase());
}

/** Whether `type` is a release type where the album and song should share release-level fields like links and roles. */
export function albumTypeSharesSongReleaseFields(type) {
	return SONG_SHARED_RELEASE_FIELD_ALBUM_TYPES.has(String(type ?? '').toUpperCase());
}

/** True if any of a song's album placements is on a release type that grants it its own links (see `albumTypeAllowsSongLinks`). */
export function songPlacementsAllowOwnLinks(placements, albumById = {}) {
	if (!Array.isArray(placements)) return false;

	return placements.some((placement) => {
		const album = placement?.album ?? albumById[placement?.albumId] ?? null;
		return albumTypeAllowsSongLinks(album?.type);
	});
}

/** True if any placement is on a release where song and album links/roles should stay synchronized. */
export function songPlacementsShareReleaseFields(placements, albumById = {}) {
	if (!Array.isArray(placements)) return false;

	return placements.some((placement) => {
		const album = placement?.album ?? albumById[placement?.albumId] ?? null;
		return albumTypeSharesSongReleaseFields(album?.type);
	});
}
