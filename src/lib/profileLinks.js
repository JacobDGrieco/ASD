/**
 * Bridges two generations of the "social/streaming links" data model. Artist,
 * FashionTalent, and music-release (Album/Song) records originally had one fixed
 * string column per platform (e.g. `soundcloudProfile`, `spotifyUrl`) — they've
 * since gained a single generic `links: Json` field holding an array of
 * `{ id, platform, type, url }` entries, but the legacy columns are still read/
 * written for backward compatibility. This module is the translation layer so both
 * representations stay usable and roughly in sync.
 *
 * `profileLinksForSource` is the read-side entry point (prefers `links`, falls back
 * to the legacy columns via `*_LEGACY_LINK_FIELDS`); `legacyFieldsFromProfileLinks`
 * is the write-side equivalent for the endpoints that still populate legacy columns.
 *
 * Runs in both server (`api/public.js`, `api/admin/*.js` formatters) and client
 * (`AdminProfileLinksField`/`AdminProfileLinksSummary`, public link rendering)
 * contexts — pure data transforms, no I/O.
 */
export const PROFILE_LINK_TYPES = [
	{ value: 'professional', label: 'Professional' },
	{ value: 'personal', label: 'Personal' },
];

export const PROFILE_LINK_PLATFORM_OPTIONS = [
	{ value: 'spotify', label: 'Spotify' },
	{ value: 'appleMusic', label: 'Apple Music' },
	{ value: 'soundcloud', label: 'SoundCloud' },
	{ value: 'youtubeMusic', label: 'YouTube Music' },
	{ value: 'youtube', label: 'YouTube' },
	{ value: 'bandcamp', label: 'Bandcamp' },
	{ value: 'audiomack', label: 'Audiomack' },
	{ value: 'tidal', label: 'Tidal' },
	{ value: 'deezer', label: 'Deezer' },
	{ value: 'instagram', label: 'Instagram' },
	{ value: 'tiktok', label: 'TikTok' },
	{ value: 'x', label: 'X' },
	{ value: 'facebook', label: 'Facebook' },
	{ value: 'snapchat', label: 'Snapchat' },
	{ value: 'threads', label: 'Threads' },
	{ value: 'bluesky', label: 'Bluesky' },
	{ value: 'twitch', label: 'Twitch' },
	{ value: 'discord', label: 'Discord' },
	{ value: 'patreon', label: 'Patreon' },
	{ value: 'linktree', label: 'Linktree' },
	{ value: 'website', label: 'Website' },
	{ value: 'email', label: 'Email' },
];

export const PROFILE_LINK_PLATFORM_LABELS = Object.fromEntries(
	PROFILE_LINK_PLATFORM_OPTIONS.map((option) => [option.value, option.label])
);

const PLATFORM_VALUES = new Set(PROFILE_LINK_PLATFORM_OPTIONS.map((option) => option.value));
const PLATFORM_ORDER = Object.fromEntries(
	PROFILE_LINK_PLATFORM_OPTIONS.map((option, index) => [option.value, index])
);
const LINK_TYPE_VALUES = new Set(PROFILE_LINK_TYPES.map((option) => option.value));
const LINK_TYPE_ORDER = {
	professional: 0,
	personal: 1,
};

export const ARTIST_LEGACY_LINK_FIELDS = [
	{ field: 'soundcloudProfile', platform: 'soundcloud', type: 'professional' },
	{ field: 'spotifyProfile', platform: 'spotify', type: 'professional' },
	{ field: 'appleMusicProfile', platform: 'appleMusic', type: 'professional' },
	{ field: 'youtubeProfile', platform: 'youtubeMusic', type: 'professional' },
	{ field: 'instagramProfile', platform: 'instagram', type: 'personal' },
	{ field: 'twitterProfile', platform: 'x', type: 'personal' },
	{ field: 'facebookProfile', platform: 'facebook', type: 'personal' },
	{ field: 'tiktokProfile', platform: 'tiktok', type: 'personal' },
	{ field: 'snapchatProfile', platform: 'snapchat', type: 'personal' },
	{ field: 'youtubeSocialProfile', platform: 'youtube', type: 'personal' },
];

export const FASHION_TALENT_LEGACY_LINK_FIELDS = [
	{ field: 'instagramProfile', platform: 'instagram', type: 'personal' },
	{ field: 'tiktokProfile', platform: 'tiktok', type: 'personal' },
	{ field: 'twitterProfile', platform: 'x', type: 'personal' },
	{ field: 'youtubeProfile', platform: 'youtube', type: 'personal' },
	{ field: 'facebookProfile', platform: 'facebook', type: 'personal' },
	{ field: 'website', platform: 'website', type: 'professional' },
	{ field: 'email', platform: 'email', type: 'professional' },
];

export const MUSIC_RELEASE_LEGACY_LINK_FIELDS = [
	{ field: 'soundcloudUrl', platform: 'soundcloud', type: 'professional' },
	{ field: 'spotifyUrl', platform: 'spotify', type: 'professional' },
	{ field: 'appleMusicUrl', platform: 'appleMusic', type: 'professional' },
	{ field: 'youtubeUrl', platform: 'youtube', type: 'professional' },
];

/** Professional links before personal, then platforms in the same order as `PROFILE_LINK_PLATFORM_OPTIONS`. */
export function sortProfileLinks(value) {
	if (!Array.isArray(value)) return [];

	return [...value].sort((a, b) => {
		const aOrder = LINK_TYPE_ORDER[a?.type] ?? LINK_TYPE_ORDER.personal;
		const bOrder = LINK_TYPE_ORDER[b?.type] ?? LINK_TYPE_ORDER.personal;
		if (aOrder !== bOrder) return aOrder - bOrder;

		const aPlatformOrder = PLATFORM_ORDER[a?.platform] ?? Number.MAX_SAFE_INTEGER;
		const bPlatformOrder = PLATFORM_ORDER[b?.platform] ?? Number.MAX_SAFE_INTEGER;
		return aPlatformOrder - bPlatformOrder;
	});
}

/** Sanitizes a raw `links` array: unknown platforms fall back to `'website'`, unknown types to `'personal'`, entries without a URL are dropped, and result is sorted via `sortProfileLinks`. */
export function normalizeProfileLinks(value) {
	if (!Array.isArray(value)) return [];

	const links = value.reduce((normalizedLinks, item, index) => {
		const platform = PLATFORM_VALUES.has(item?.platform) ? item.platform : 'website';
		const type = LINK_TYPE_VALUES.has(item?.type) ? item.type : 'personal';
		const url = typeof item?.url === 'string' ? item.url.trim() : '';
		if (!url) return normalizedLinks;

		normalizedLinks.push({
			id: typeof item?.id === 'string' && item.id ? item.id : `${platform}-${type}-${index}`,
			platform,
			type,
			url,
		});
		return normalizedLinks;
	}, []);

	return sortProfileLinks(links);
}

/** Reconstructs a normalized links array from `source`'s legacy per-platform columns, per one of the `*_LEGACY_LINK_FIELDS` maps. */
export function profileLinksFromLegacy(source, fields) {
	const links = fields.reduce((legacyLinks, field, index) => {
		const url = typeof source?.[field.field] === 'string' ? source[field.field].trim() : '';
		if (!url) return legacyLinks;
		legacyLinks.push({
			id: `${field.platform}-${field.type}-${index}`,
			platform: field.platform,
			type: field.type,
			url,
		});
		return legacyLinks;
	}, []);

	return sortProfileLinks(links);
}

/**
 * The main read-side accessor: prefers `source.links` if it has any entries,
 * otherwise reconstructs links from the legacy columns. This means a record that
 * has ever been saved with the new `links` field stops reading its legacy columns
 * entirely, even if they still hold values.
 */
export function profileLinksForSource(source, fields) {
	const links = normalizeProfileLinks(source?.links);
	return links.length ? links : profileLinksFromLegacy(source, fields);
}

/**
 * Write-side equivalent of `profileLinksFromLegacy`: given a normalized `links`
 * array, produces a `{ [legacyColumn]: url | null }` object so an admin endpoint
 * can keep legacy columns populated alongside the new `links` field. If multiple
 * links match the same legacy field's platform/type, only the first is kept.
 */
export function legacyFieldsFromProfileLinks(links, fields) {
	const normalized = normalizeProfileLinks(links);
	const nextFields = Object.fromEntries(fields.map((field) => [field.field, null]));

	for (const link of normalized) {
		const match = fields.find((field) => (
			field.platform === link.platform &&
			field.type === link.type &&
			nextFields[field.field] === null
		));
		if (match) nextFields[match.field] = link.url;
	}

	return nextFields;
}

/** Builds a clickable `href` for a profile link: adds `mailto:` for bare email addresses, adds `https:` for protocol-relative/bare-domain URLs, otherwise passes the URL through as-is. */
export function hrefForProfileLink(link) {
	const url = typeof link?.url === 'string' ? link.url.trim() : '';
	if (!url) return '';
	if (link.platform === 'email' && !url.startsWith('mailto:')) return `mailto:${url}`;
	if (/^[a-z][a-z\d+.-]*:/i.test(url)) return url;
	if (url.startsWith('//')) return `https:${url}`;
	if (link.platform !== 'email') return `https://${url}`;
	return url;
}
