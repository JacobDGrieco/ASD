/** The fixed set of music credit roles offered in song and album editors, and their public-facing display labels (e.g. "Producer" -> "Produced by"). */
export const SONG_ROLES = [
	'Featured Artist',
	'Producer',
	'Composer',
	'Lyricist',
	'Drummer',
	'Bassist',
	'Guitarist',
	'Keyboardist',
	'Vocalist',
	'Mixing Engineer',
	'Mastering Engineer',
	'Recording Engineer',
	'Artwork',
	'Photographer',
	'Videographer',
	'Director',
	'Video Editor',
	'Creative Director',
	'Art Director',
];

export const ROLE_DISPLAY_LABELS = {
	'Featured Artist': 'Featuring',
	'Producer': 'Produced by',
	'Composer': 'Composed by',
	'Lyricist': 'Lyrics by',
	'Drummer': 'Drums',
	'Bassist': 'Bass',
	'Guitarist': 'Guitar',
	'Keyboardist': 'Keys',
	'Vocalist': 'Vocals',
	'Mixing Engineer': 'Mixed by',
	'Mastering Engineer': 'Mastered by',
	'Recording Engineer': 'Recorded by',
	'Artwork': 'Artwork by',
	'Photographer': 'Photography by',
	'Videographer': 'Video by',
	'Director': 'Directed by',
	'Video Editor': 'Edited by',
	'Creative Director': 'Creative direction by',
	'Art Director': 'Art direction by',
};

export function musicRoleSortIndex(role) {
	const index = SONG_ROLES.indexOf(role);
	return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function compareMusicRoleEntries(left, right) {
	return musicRoleSortIndex(left?.role) - musicRoleSortIndex(right?.role);
}

export function sortMusicRoleEntries(roles) {
	return Array.isArray(roles) ? roles.toSorted(compareMusicRoleEntries) : [];
}
