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
const LINK_TYPE_VALUES = new Set(PROFILE_LINK_TYPES.map((option) => option.value));

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

export function normalizeProfileLinks(value) {
	if (!Array.isArray(value)) return [];

	return value.reduce((links, item, index) => {
		const platform = PLATFORM_VALUES.has(item?.platform) ? item.platform : 'website';
		const type = LINK_TYPE_VALUES.has(item?.type) ? item.type : 'personal';
		const url = typeof item?.url === 'string' ? item.url.trim() : '';
		if (!url) return links;

		links.push({
			id: typeof item?.id === 'string' && item.id ? item.id : `${platform}-${type}-${index}`,
			platform,
			type,
			url,
		});
		return links;
	}, []);
}

export function profileLinksFromLegacy(source, fields) {
	return fields.reduce((links, field, index) => {
		const url = typeof source?.[field.field] === 'string' ? source[field.field].trim() : '';
		if (!url) return links;
		links.push({
			id: `${field.platform}-${field.type}-${index}`,
			platform: field.platform,
			type: field.type,
			url,
		});
		return links;
	}, []);
}

export function profileLinksForSource(source, fields) {
	const links = normalizeProfileLinks(source?.links);
	return links.length ? links : profileLinksFromLegacy(source, fields);
}

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

export function hrefForProfileLink(link) {
	const url = typeof link?.url === 'string' ? link.url.trim() : '';
	if (!url) return '';
	if (link.platform === 'email' && !url.startsWith('mailto:')) return `mailto:${url}`;
	if (/^[a-z][a-z\d+.-]*:/i.test(url)) return url;
	if (url.startsWith('//')) return `https:${url}`;
	if (link.platform !== 'email') return `https://${url}`;
	return url;
}
