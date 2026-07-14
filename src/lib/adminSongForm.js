import { defaultVisibilityForReleaseDate } from './contentVisibility.js';
import { MUSIC_RELEASE_LEGACY_LINK_FIELDS, profileLinksForSource } from './profileLinks.js';

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

export function hasManualSongVisibilityChoice(song) {
	const releaseDate = song?.meta?.releaseDate ?? song?.placements?.[0]?.album?.releaseDate ?? '';
	const defaultVisibility = defaultVisibilityForReleaseDate(releaseDate);
	return (
		song?.isVisible !== defaultVisibility.isVisible ||
		Boolean(song?.autoShowOnRelease) !== defaultVisibility.autoShowOnRelease
	);
}

export function buildSongFormFromDetail(detail) {
	return {
		...emptySongForm,
		...detail,
		images: detail.images ?? [],
		links: profileLinksForSource(detail, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
		aboutText: detail.meta?.aboutText ?? '',
		roles: Array.isArray(detail.meta?.roles)
			? detail.meta.roles.map((entry) => createRoleEntry(entry.role, entry.name, {
				artistId: entry.artistId,
				outsideArtistId: entry.outsideArtistId,
				externalUrl: entry.externalUrl,
			}))
			: [],
		tags: detail.meta?.tags ?? [],
		bpm: detail.meta?.bpm ?? '',
		key: detail.meta?.key ?? '',
		releaseDate: detail.meta?.releaseDate ? detail.meta.releaseDate.slice(0, 10) : '',
		albumPlacements: buildPlacementForm(detail),
	};
}

export function initSongFormFromPrefill(prefill = {}) {
	return {
		...emptySongForm,
		title: prefill.title ?? '',
		releaseDate: prefill.releaseDate ?? '',
		links: profileLinksForSource(prefill, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
		soundcloudUrl: prefill.soundcloudUrl ?? '',
		spotifyUrl: prefill.spotifyUrl ?? '',
		appleMusicUrl: prefill.appleMusicUrl ?? '',
		youtubeUrl: prefill.youtubeUrl ?? '',
		...defaultVisibilityForReleaseDate(prefill.releaseDate ?? ''),
		albumPlacements: [{
			...createAlbumPlacement(),
			albumId: prefill.albumId ?? '',
			trackNumber: 1,
			discNumber: 1,
		}],
	};
}
