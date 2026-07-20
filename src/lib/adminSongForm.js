/**
 * Client-side form-state helpers for the admin song editor (`AdminSongFormModal`).
 * Builds the initial form shape from either an existing song (edit mode) or a
 * prefill object (e.g. creating a song from within the Albums page), and handles
 * the "server record -> editable draft" and reverse shape differences (e.g. role
 * entries and album placements need stable per-row client keys the server doesn't
 * track). Client-only.
 */
import { defaultVisibilityForReleaseDate } from './contentVisibility.js';
import { albumTypeSharesSongReleaseFields } from './musicReleaseLinks.js';
import { MUSIC_RELEASE_LEGACY_LINK_FIELDS, profileLinksForSource } from './profileLinks.js';
import { normalizeSongDuration } from './songDuration.js';
import { sortMusicRoleEntries } from './songRoles.js';

// Stable per-row identity for list fields (role credits, album placements) that
// have no server-assigned id yet — lets React key list items correctly while a new
// row is being edited, before it's ever saved.
function createClientKey(prefix) {
	return `${prefix}-${crypto.randomUUID()}`;
}

export function createAlbumPlacement() {
	return { clientKey: createClientKey('placement'), albumId: '', trackNumber: '', discNumber: 1 };
}

export function createRoleEntry(role = 'Featured Artist', name = '', extra = {}) {
	return {
		clientKey: createClientKey('role'),
		role,
		name,
		artistId: extra.artistId ?? '',
		outsideArtistId: extra.outsideArtistId ?? '',
		externalUrl: extra.externalUrl ?? '',
		...(extra.applyToSongs !== undefined ? { applyToSongs: Boolean(extra.applyToSongs) } : {}),
	};
}

export const emptySongForm = {
	title: '',
	slug: '',
	isVisible: true,
	autoShowOnRelease: false,
	duration: '',
	links: [],
	soundcloudUrl: '',
	spotifyUrl: '',
	appleMusicUrl: '',
	youtubeUrl: '',
	aboutText: '',
	roles: [],
	releaseDate: '',
	images: [],
	tags: [],
	bpm: '',
	key: '',
	albumPlacements: [createAlbumPlacement()],
};

// Normalizes a song's album placements into form rows, checking three possible
// server shapes in order (new-style albumPlacements, legacy placements with a
// nested album, or a flat single albumId) so the form works against whichever
// shape the loaded record happens to have.
function buildPlacementForm(song) {
	if (Array.isArray(song.albumPlacements) && song.albumPlacements.length) {
		return song.albumPlacements.map((p) => ({
			clientKey: createClientKey('placement'),
			albumId: p.albumId ?? '',
			trackNumber: Number(p.trackNumber ?? 1),
			discNumber: Number(p.discNumber ?? 1),
		}));
	}
	if (Array.isArray(song.placements) && song.placements.length) {
		return song.placements.map((p) => ({
			clientKey: createClientKey('placement'),
			albumId: p.albumId ?? p.album?.id ?? '',
			trackNumber: Number(p.trackNumber ?? 1),
			discNumber: Number(p.discNumber ?? 1),
		}));
	}
	if (song.albumId) {
		return [{ clientKey: createClientKey('placement'), albumId: song.albumId, trackNumber: Number(song.trackNumber ?? 1), discNumber: Number(song.discNumber ?? 1) }];
	}
	return [createAlbumPlacement()];
}

function sharedReleaseAlbum(song) {
	const placements = Array.isArray(song?.placements) ? song.placements : [];
	return placements.find((placement) => albumTypeSharesSongReleaseFields(placement.album?.type))?.album ?? null;
}

function earliestPlacementAlbumReleaseDate(song) {
	const releaseDates = (Array.isArray(song?.placements) ? song.placements : [])
		.map((placement) => placement.album?.releaseDate ? String(placement.album.releaseDate).slice(0, 10) : '')
		.filter(Boolean)
		.sort();
	return releaseDates[0] ?? '';
}

function roleEntriesFromSource(roles) {
	return sortMusicRoleEntries(Array.isArray(roles)
		? roles.map((entry) => createRoleEntry(entry.role, entry.name, {
			artistId: entry.artistId,
			outsideArtistId: entry.outsideArtistId,
			externalUrl: entry.externalUrl,
			applyToSongs: entry.applyToSongs,
		}))
		: []);
}

export function roleEntryKey(role) {
	const personKey = role.artistId
		? `artist:${role.artistId}`
		: role.outsideArtistId
			? `outside:${role.outsideArtistId}`
			: `name:${String(role.name ?? '').trim().toLowerCase()}`;
	return `${role.role}:${personKey}`;
}

export function albumRoleAppliesToSongs(role) {
	return role?.applyToSongs !== false;
}

/** Fetches full song detail for the editor, throwing with the server's error message (or a generic one) on failure. */
export async function loadAdminSongDetail(songId, token) {
	const response = await fetch(`/api/admin/songs?id=${songId}`, { headers: { Authorization: `Bearer ${token}` } });
	const contentType = response.headers.get('content-type') ?? '';
	const payload = contentType.includes('application/json')
		? await response.json().catch(() => null)
		: await response.text().catch(() => '');

	if (!response.ok) {
		const message = payload && typeof payload === 'object'
			? payload.error
			: String(payload || '').trim();
		throw new Error(message || `Failed to load song (${response.status})`);
	}

	return payload;
}

/**
 * Whether a song's current visibility differs from what `defaultVisibilityForReleaseDate`
 * would produce for its release date — i.e. whether an admin has manually
 * overridden the auto-computed default. The song form uses this to decide whether
 * to keep recalculating visibility as the release date changes, or to leave the
 * admin's explicit choice alone (see `visibilityTouchedRef` pattern in the form
 * components).
 */
export function hasManualSongVisibilityChoice(song) {
	const releaseDate = song?.meta?.releaseDate ?? earliestPlacementAlbumReleaseDate(song);
	const defaultVisibility = defaultVisibilityForReleaseDate(releaseDate);
	return (
		song?.isVisible !== defaultVisibility.isVisible ||
		Boolean(song?.autoShowOnRelease) !== defaultVisibility.autoShowOnRelease
	);
}

/** Builds editable form state from a fetched song record (edit mode). */
export function buildSongFormFromDetail(detail) {
	const sharedAlbum = sharedReleaseAlbum(detail);
	const songLinks = profileLinksForSource(detail, MUSIC_RELEASE_LEGACY_LINK_FIELDS);
	const sharedAlbumLinks = sharedAlbum ? profileLinksForSource(sharedAlbum, MUSIC_RELEASE_LEGACY_LINK_FIELDS) : [];
	const songRoles = roleEntriesFromSource(detail.meta?.roles);

	return {
		...emptySongForm,
		...detail,
		duration: normalizeSongDuration(detail.duration) ?? '',
		images: detail.images ?? [],
		links: songLinks.length ? songLinks : sharedAlbumLinks,
		aboutText: detail.meta?.aboutText ?? '',
		roles: songRoles,
		tags: detail.meta?.tags ?? [],
		bpm: detail.meta?.bpm ?? '',
		key: detail.meta?.key ?? '',
		releaseDate: detail.meta?.releaseDate ? detail.meta.releaseDate.slice(0, 10) : '',
		albumPlacements: buildPlacementForm(detail),
	};
}

/** Builds initial form state for a brand-new song, optionally prefilled (e.g. from "create song" launched off an Album's page with its release date/album already chosen). */
export function initSongFormFromPrefill(prefill = {}) {
	const releaseDate = prefill.releaseDate ?? '';
	const visibilityDefaults = defaultVisibilityForReleaseDate(releaseDate);

	return {
		...emptySongForm,
		title: prefill.title ?? '',
		duration: normalizeSongDuration(prefill.duration) ?? '',
		isVisible: prefill.isVisible ?? visibilityDefaults.isVisible,
		autoShowOnRelease: prefill.autoShowOnRelease ?? visibilityDefaults.autoShowOnRelease,
		releaseDate,
		aboutText: prefill.aboutText ?? '',
		images: Array.isArray(prefill.images)
			? prefill.images.map((image) => ({ ...image, usage: 'artwork' }))
			: [],
		links: profileLinksForSource(prefill, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
		roles: roleEntriesFromSource((prefill.roles ?? []).filter(albumRoleAppliesToSongs)),
		soundcloudUrl: prefill.soundcloudUrl ?? '',
		spotifyUrl: prefill.spotifyUrl ?? '',
		appleMusicUrl: prefill.appleMusicUrl ?? '',
		youtubeUrl: prefill.youtubeUrl ?? '',
		albumPlacements: [{
			...createAlbumPlacement(),
			albumId: prefill.albumId ?? '',
			trackNumber: 1,
			discNumber: 1,
		}],
	};
}
