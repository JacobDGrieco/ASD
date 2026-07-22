/**
 * Admin read/write for a song's lyric text (`SongLyric.text` — the annotations
 * themselves are managed separately by `annotations.js`). GET returns an empty
 * placeholder rather than 404 if no lyric row exists yet, so the editor can start
 * from a blank state for a song that's never had lyrics entered. Requires
 * `MUSIC_SONGS` page access; write additionally requires a non-viewer role, and the
 * song lookup is scoped through `artistScopedSongWhere` so an ARTIST session can't
 * touch another artist's lyrics.
 *
 * Server-only (Vercel Function). Consumed by `AdminMusicLyricsPage.jsx`.
 */
import { prisma } from '../../src/lib/prisma.js';
import { artistScopedSongWhere, canAccessAdminPage, isViewer, requireAdmin } from '../../src/lib/auth.js';
import { ADMIN_PAGE_KEYS } from '../../src/lib/adminPageAccess.js';
import { isReleasedOnUtcDay } from '../../src/lib/releaseSchedule.js';

async function loadSongForLyrics(session, songId) {
	const song = await prisma.song.findFirst({
		where: {
			id: songId,
			...artistScopedSongWhere(session),
		},
		select: {
			id: true,
			title: true,
			soundcloudUrl: true,
			privateSoundcloudUrl: true,
			duration: true,
			meta: {
				select: { releaseDate: true },
			},
			placements: {
				orderBy: [{ placementOrder: 'asc' }],
				select: {
					album: {
						select: { releaseDate: true },
					},
				},
			},
		},
	});

	return song ? formatSongForLyrics(song) : null;
}

function trimUrl(value) {
	const url = typeof value === 'string' ? value.trim() : '';
	return url || null;
}

function effectiveSongReleaseDate(song) {
	if (song?.meta?.releaseDate) return song.meta.releaseDate;
	const releaseDates = (Array.isArray(song?.placements) ? song.placements : [])
		.flatMap((placement) => (placement.album?.releaseDate ? [placement.album.releaseDate] : []))
		.sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
	return releaseDates[0] ?? null;
}

function formatSongForLyrics(song) {
	const privateSoundcloudUrl = trimUrl(song.privateSoundcloudUrl);
	const officialSoundcloudUrl = trimUrl(song.soundcloudUrl);
	const releaseDate = effectiveSongReleaseDate(song);
	const shouldUsePrivateSoundcloud = privateSoundcloudUrl && !isReleasedOnUtcDay(releaseDate);

	return {
		...song,
		adminSoundcloudUrl: shouldUsePrivateSoundcloud ? privateSoundcloudUrl : officialSoundcloudUrl,
		adminSoundcloudSource: shouldUsePrivateSoundcloud ? 'private' : 'official',
		effectiveReleaseDate: releaseDate,
	};
}

function normalizeSyncedLines(input, text) {
	if (!Array.isArray(input)) return [];

	const lines = String(text ?? '').split('\n');
	const seen = new Set();
	const normalized = [];

	for (const item of input) {
		const lineIndex = Number(item?.lineIndex);
		const startMs = Math.round(Number(item?.startMs));
		const endMs = Math.round(Number(item?.endMs));

		if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= lines.length) continue;
		if (!lines[lineIndex]?.trim()) continue;
		if (isBracketedLyricCue(lines[lineIndex])) continue;
		if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
		if (startMs < 0 || endMs <= startMs) continue;
		if (seen.has(lineIndex)) continue;

		seen.add(lineIndex);
		normalized.push({ lineIndex, startMs, endMs });
	}

	return normalized.sort((left, right) => left.lineIndex - right.lineIndex);
}

function isBracketedLyricCue(line) {
	const trimmed = String(line ?? '').trim();
	return trimmed.length >= 2 && trimmed.startsWith('[') && trimmed.endsWith(']');
}

export default async function handler(req, res) {
	const session = requireAdmin(req, res);
	if (!session) return;
	if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.MUSIC_SONGS)) return res.status(403).json({ error: 'Forbidden' });

	const { songId } = req.query;

	if (!songId) return res.status(400).json({ error: 'songId required' });

	const song = await loadSongForLyrics(session, songId);
	if (!song) return res.status(404).json({ error: 'Song not found' });

	if (req.method === 'GET') {
		const lyric = await prisma.songLyric.findUnique({
			where: { songId },
			include: {
				annotations: {
					orderBy: { createdAt: 'asc' },
					include: { ranges: { orderBy: { startChar: 'asc' } } },
				},
			},
		});

		if (!lyric) {
			return res.status(200).json({ id: null, songId, text: '', syncedLines: [], annotations: [], song });
		}

		return res.status(200).json({ ...lyric, song });
	}

	if (req.method === 'PUT') {
		if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' });

		const { text, syncedLines } = req.body;
		const normalizedText = typeof text === 'string' ? text : '';
		const normalizedSyncedLines = normalizeSyncedLines(syncedLines, normalizedText);

		const upserted = await prisma.songLyric.upsert({
			where: { songId },
			create: { songId, text: normalizedText, syncedLines: normalizedSyncedLines },
			update: { text: normalizedText, syncedLines: normalizedSyncedLines },
		});

		return res.status(200).json(upserted);
	}

	return res.status(405).json({ error: 'Method not allowed' });
}
