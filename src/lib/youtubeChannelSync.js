/**
 * Syncs the "Crosshair" video library from a YouTube channel's uploads, so the
 * label doesn't have to manually re-enter every video already published on YouTube.
 *
 * Runs server-only — called from `api/admin/crosshair.js`'s `action=sync`, a
 * manual admin action (there is no cron/webhook trigger). Talks to the YouTube Data
 * API v3 and, in OAuth mode, Google's OAuth token endpoint.
 *
 * Two auth modes, resolved by `selectAuthMode`:
 * - Public/API-key (`YOUTUBE_API_KEY` + `YOUTUBE_CHANNEL_ID`/`YOUTUBE_CHANNEL_HANDLE`):
 *   only sees public/unlisted videos as far as the API exposes them, no private access.
 * - OAuth (`YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET`/`YOUTUBE_REFRESH_TOKEN`):
 *   required to see unlisted videos reliably; exchanges the refresh token for a
 *   fresh access token on every sync.
 *
 * Manual-edit protection: a video whose `source` isn't `'YOUTUBE_SYNC'` (i.e. a
 * human created/edited it directly) keeps its title/description/type/thumbnail/
 * publishedAt across resyncs — only technical metadata (duration, privacy status,
 * lastSyncedAt, the URL itself) is refreshed. `isVisible` is always preserved from
 * the current row regardless of source, so hiding a video sticks across syncs.
 */
import { prisma } from './prisma.js';
import { CROSSHAIR_VIDEO_TYPE, formatCrosshairVideo } from './crosshairVideos.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_SYNC_SOURCE = 'YOUTUBE_SYNC';

function env(name) {
	return typeof process !== 'undefined' ? process.env[name] : undefined;
}

function requireFetch() {
	if (typeof fetch !== 'function') {
		throw new Error('Global fetch is not available in this runtime.');
	}
}

function chunk(items, size) {
	const chunks = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
}

// Parses YouTube's ISO-8601 duration format (e.g. "PT4M13S") into seconds.
function parseIsoDurationSeconds(value) {
	if (typeof value !== 'string') return null;
	const match = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
	if (!match) return null;

	const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = match;
	return (
		Number.parseInt(days, 10) * 86400 +
		Number.parseInt(hours, 10) * 3600 +
		Number.parseInt(minutes, 10) * 60 +
		Number.parseInt(seconds, 10)
	);
}

function bestThumbnail(thumbnails = {}) {
	return thumbnails.maxres?.url
		|| thumbnails.standard?.url
		|| thumbnails.high?.url
		|| thumbnails.medium?.url
		|| thumbnails.default?.url
		|| null;
}

function youtubeWatchUrl(videoId) {
	return `https://www.youtube.com/watch?v=${videoId}`;
}

// A synced video is classified SHORT purely by duration (<=60s, matching YouTube's
// own Shorts cutoff) — there's no way to distinguish EDITED from the sync alone, so
// synced videos always land as either SHORT or UNCUT; EDITED is only reachable via
// manual admin entry.
function classifyVideoType(video) {
	const durationSeconds = parseIsoDurationSeconds(video.contentDetails?.duration);
	if (durationSeconds !== null && durationSeconds <= 60) return CROSSHAIR_VIDEO_TYPE.SHORT;
	return CROSSHAIR_VIDEO_TYPE.UNCUT;
}

function configuredPublicAuth() {
	const apiKey = env('YOUTUBE_API_KEY');
	const channelId = env('YOUTUBE_CHANNEL_ID');
	const channelHandle = env('YOUTUBE_CHANNEL_HANDLE');
	if (!apiKey) return null;
	if (!channelId && !channelHandle) return null;
	return { kind: 'apiKey', apiKey, channelId, channelHandle };
}

function configuredOAuthAuth() {
	const clientId = env('YOUTUBE_CLIENT_ID');
	const clientSecret = env('YOUTUBE_CLIENT_SECRET');
	const refreshToken = env('YOUTUBE_REFRESH_TOKEN');
	if (!clientId || !clientSecret || !refreshToken) return null;
	return { kind: 'oauth', clientId, clientSecret, refreshToken, channelId: env('YOUTUBE_CHANNEL_ID') };
}

async function fetchJson(url, { accessToken } = {}) {
	requireFetch();
	const response = await fetch(url, {
		headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
	});
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		const message = body?.error?.message || body?.error || `YouTube API request failed (${response.status})`;
		throw new Error(message);
	}
	return body;
}

async function fetchOAuthAccessToken(config) {
	requireFetch();
	const body = new URLSearchParams({
		client_id: config.clientId,
		client_secret: config.clientSecret,
		refresh_token: config.refreshToken,
		grant_type: 'refresh_token',
	});
	const response = await fetch(GOOGLE_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	});
	const payload = await response.json().catch(() => null);
	if (!response.ok || !payload?.access_token) {
		throw new Error(payload?.error_description || payload?.error || 'Could not refresh YouTube OAuth token.');
	}
	return payload.access_token;
}

function youtubeUrl(path, params, auth) {
	const url = new URL(`${YOUTUBE_API_BASE}/${path}`);
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
	}
	if (auth?.apiKey) url.searchParams.set('key', auth.apiKey);
	return url;
}

async function resolveUploadsPlaylist(auth) {
	const baseParams = {
		part: 'contentDetails,snippet',
		maxResults: '1',
	};

	let params;
	if (auth.kind === 'oauth') {
		params = auth.channelId ? { ...baseParams, id: auth.channelId } : { ...baseParams, mine: 'true' };
	} else {
		params = auth.channelId ? { ...baseParams, id: auth.channelId } : { ...baseParams, forHandle: auth.channelHandle };
	}

	const data = await fetchJson(youtubeUrl('channels', params, auth), auth);
	const channel = data.items?.[0];
	const playlistId = channel?.contentDetails?.relatedPlaylists?.uploads;
	if (!playlistId) throw new Error('Could not find the YouTube uploads playlist for this channel.');
	return {
		playlistId,
		channelId: channel.id,
		channelTitle: channel.snippet?.title ?? 'YouTube',
	};
}

async function fetchUploadsVideoIds(playlistId, auth) {
	const videoIds = [];
	let pageToken = '';

	do {
		const data = await fetchJson(youtubeUrl('playlistItems', {
			part: 'snippet,contentDetails',
			playlistId,
			maxResults: '50',
			pageToken,
		}, auth), auth);

		for (const item of data.items ?? []) {
			const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
			if (videoId) videoIds.push(videoId);
		}
		pageToken = data.nextPageToken || '';
	} while (pageToken);

	return [...new Set(videoIds)];
}

async function fetchVideoDetails(videoIds, auth) {
	const videoChunks = await Promise.all(chunk(videoIds, 50).map((ids) => (
		fetchJson(youtubeUrl('videos', {
			part: 'snippet,contentDetails,status',
			id: ids.join(','),
			maxResults: '50',
		}, auth), auth)
	)));

	const videos = [];
	for (const data of videoChunks) {
		videos.push(...(data.items ?? []));
	}
	return videos;
}

// Upserts one synced video, preserving human-entered fields if the existing row
// wasn't itself created by a previous sync (see module header). A custom thumbnail
// (identified by having a thumbnailPathname, i.e. an uploaded blob) is also kept
// even on an otherwise-synced row, since re-syncing shouldn't discard a manually
// uploaded thumbnail.
async function saveSyncedVideo(video, existingByVideoId) {
	const current = existingByVideoId.get(video.youtubeVideoId);
	if (!current) {
		return prisma.crosshairVideo.create({ data: video });
	}

	const isManualOverride = current.source !== YOUTUBE_SYNC_SOURCE;
	return prisma.crosshairVideo.update({
		where: { id: current.id },
		data: {
			youtubeUrl: video.youtubeUrl,
			youtubeVideoId: video.youtubeVideoId,
			durationSeconds: video.durationSeconds,
			privacyStatus: video.privacyStatus,
			lastSyncedAt: video.lastSyncedAt,
			source: current.source || YOUTUBE_SYNC_SOURCE,
			title: isManualOverride ? current.title : video.title,
			description: isManualOverride ? current.description : video.description,
			type: isManualOverride ? current.type : video.type,
			thumbnailUrl: (current.thumbnailPathname || isManualOverride) ? current.thumbnailUrl : video.thumbnailUrl,
			publishedAt: isManualOverride ? current.publishedAt : video.publishedAt,
			isVisible: current.isVisible,
		},
	});
}

function toSyncedVideo(video) {
	const videoId = video.id;
	const durationSeconds = parseIsoDurationSeconds(video.contentDetails?.duration);
	const privacyStatus = video.status?.privacyStatus ?? null;

	return {
		youtubeVideoId: videoId,
		title: video.snippet?.title || 'Untitled YouTube video',
		description: video.snippet?.description || '',
		type: classifyVideoType(video),
		youtubeUrl: youtubeWatchUrl(videoId),
		thumbnailUrl: bestThumbnail(video.snippet?.thumbnails),
		thumbnailPathname: null,
		source: YOUTUBE_SYNC_SOURCE,
		durationSeconds,
		privacyStatus,
		isVisible: privacyStatus !== 'private' && video.status?.embeddable !== false,
		publishedAt: video.snippet?.publishedAt ? new Date(video.snippet.publishedAt) : null,
		lastSyncedAt: new Date(),
	};
}

async function upsertSyncedVideos(syncedVideos) {
	const existing = await prisma.crosshairVideo.findMany({
		where: {
			youtubeVideoId: {
				in: syncedVideos.map((video) => video.youtubeVideoId),
			},
		},
	});
	const existingByVideoId = new Map(existing.map((video) => [video.youtubeVideoId, video]));
	return Promise.all(syncedVideos.map((video) => saveSyncedVideo(video, existingByVideoId)));
}

function selectAuthMode(mode = 'auto') {
	const oauth = configuredOAuthAuth();
	const publicAuth = configuredPublicAuth();

	if (mode === 'oauth') return oauth;
	if (mode === 'public') return publicAuth;
	return oauth || publicAuth;
}

/** Reports which auth modes are configured via env vars, for the admin UI to show sync availability without attempting a sync. */
export function getYouTubeSyncConfigStatus() {
	return {
		publicApiConfigured: Boolean(configuredPublicAuth()),
		oauthConfigured: Boolean(configuredOAuthAuth()),
	};
}

/**
 * Runs a full sync: resolves the channel's uploads playlist, pages through every
 * video in it, fetches full details in batches of 50, filters to public/unlisted
 * (excluding private and deleted uploads), and upserts each into `CrosshairVideo`.
 *
 * @param {{mode?: 'auto'|'oauth'|'public'}} [options] - `'auto'` (default) prefers
 *   OAuth if configured, else falls back to the public API key mode.
 * @throws {Error} If no auth mode is configured, or any YouTube/Google API call fails.
 */
export async function syncCrosshairFromYouTube({ mode = 'auto' } = {}) {
	const config = selectAuthMode(mode);
	if (!config) {
		throw new Error('YouTube sync is not configured. Add YOUTUBE_API_KEY plus YOUTUBE_CHANNEL_ID or YOUTUBE_CHANNEL_HANDLE for public sync, or YouTube OAuth credentials for unlisted sync.');
	}

	const auth = { ...config };
	if (config.kind === 'oauth') {
		auth.accessToken = await fetchOAuthAccessToken(config);
	}

	const channel = await resolveUploadsPlaylist(auth);
	const videoIds = await fetchUploadsVideoIds(channel.playlistId, auth);
	const details = await fetchVideoDetails(videoIds, auth);
	const syncedVideos = details.reduce((videos, video) => {
		if (!video.id || video.status?.uploadStatus === 'deleted') return videos;
		if (video.status?.privacyStatus !== 'public' && video.status?.privacyStatus !== 'unlisted') return videos;
		videos.push(toSyncedVideo(video));
		return videos;
	}, []);

	const saved = await upsertSyncedVideos(syncedVideos);

	return {
		mode: config.kind,
		channelId: channel.channelId,
		channelTitle: channel.channelTitle,
		found: details.length,
		saved: saved.length,
		videos: saved.map(formatCrosshairVideo),
	};
}
