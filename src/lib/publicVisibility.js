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

export function isReservedHiddenArtist(value) {
	return isOtherArtist(value) || isAsdRecordsArtist(value);
}

export function hasPublicBoardSource(value) {
	if (!value) return false;
	if (typeof value === 'object' && value.isVisible === false) return false;
	if (isOtherArtist(value)) return false;
	return true;
}

export function buildSongPath({ song, allowHidden = false }) {
	if (!song?.id) return null;
	if (!allowHidden && song.isPubliclyVisible === false) return null;
	return `/songs/${song.id}`;
}

export function buildAlbumPath({ album, allowHidden = false }) {
	if (!album?.id) return null;
	if (!allowHidden && album.isPubliclyVisible === false) return null;
	return `/albums/${album.id}`;
}
