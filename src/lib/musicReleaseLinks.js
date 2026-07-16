const SONG_OWN_LINK_ALBUM_TYPES = new Set(['ALBUM', 'EP']);

export function albumTypeAllowsSongLinks(type) {
	return SONG_OWN_LINK_ALBUM_TYPES.has(String(type ?? '').toUpperCase());
}

export function songPlacementsAllowOwnLinks(placements, albumById = {}) {
	if (!Array.isArray(placements)) return false;

	return placements.some((placement) => {
		const album = placement?.album ?? albumById[placement?.albumId] ?? null;
		return albumTypeAllowsSongLinks(album?.type);
	});
}
