#!/usr/bin/env node
/**
 * Read-only release hygiene check.
 *
 * Reports released songs that still have private SoundCloud URLs and future-dated
 * songs that will not become publicly visible when their release date passes.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../src/lib/prisma.js';
import { resolveEffectiveVisibility } from '../src/lib/contentVisibility.js';
import { isReleasedOnUtcDay } from '../src/lib/releaseSchedule.js';
import { isReservedHiddenArtist } from '../src/lib/publicVisibility.js';

const SHOULD_FAIL_ON_ISSUES = process.argv.includes('--fail-on-issues');
const AFTER_RELEASE_CHECK_OFFSET_MS = 48 * 60 * 60 * 1000;

loadLocalEnvFiles();

function loadLocalEnvFiles() {
	for (const filename of ['.env', '.env.local']) {
		const pathname = resolve(process.cwd(), filename);
		if (!existsSync(pathname)) continue;

		for (const line of readFileSync(pathname, 'utf8').split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;

			const separatorIndex = trimmed.indexOf('=');
			if (separatorIndex === -1) continue;

			const key = trimmed.slice(0, separatorIndex).trim();
			const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
			if (key && process.env[key] === undefined) process.env[key] = value;
		}
	}
}

function dateValue(value) {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function earliestPlacementReleaseDate(placements) {
	const dates = placements
		.flatMap((placement) => {
			const date = dateValue(placement.album?.releaseDate);
			return date ? [date] : [];
		})
		.sort((left, right) => left.getTime() - right.getTime());

	return dates[0] ?? null;
}

function effectiveSongReleaseDate(song) {
	return dateValue(song.meta?.releaseDate) ?? earliestPlacementReleaseDate(song.placements ?? []);
}

function isArtistPublic(artist) {
	return Boolean(artist && artist.isVisible !== false && !isReservedHiddenArtist(artist));
}

function isAlbumEffectivelyPublic(album, now) {
	if (!album || !isArtistPublic(album.artist)) return false;
	const releaseDate = dateValue(album.releaseDate);
	return isReleasedOnUtcDay(releaseDate, now)
		&& resolveEffectiveVisibility({
			isVisible: album.isVisible,
			autoShowOnRelease: album.autoShowOnRelease,
			releaseDate,
		}, now).isVisible;
}

function isSongEffectivelyPublic(song, now) {
	const releaseDate = effectiveSongReleaseDate(song);
	const hasReleasedPlacement = (song.placements ?? []).some((placement) => isAlbumEffectivelyPublic(placement.album, now));
	return isReleasedOnUtcDay(releaseDate, now)
		&& resolveEffectiveVisibility({
			isVisible: song.isVisible,
			autoShowOnRelease: song.autoShowOnRelease,
			releaseDate,
		}, now).isVisible
		&& hasReleasedPlacement;
}

function songSummary(song) {
	const releaseDate = effectiveSongReleaseDate(song);
	return {
		id: song.id,
		title: song.title,
		releaseDate: releaseDate?.toISOString() ?? null,
		isVisible: song.isVisible,
		autoShowOnRelease: song.autoShowOnRelease,
		albums: (song.placements ?? []).map((placement) => ({
			id: placement.album.id,
			title: placement.album.title,
			releaseDate: dateValue(placement.album.releaseDate)?.toISOString() ?? null,
			isVisible: placement.album.isVisible,
			autoShowOnRelease: placement.album.autoShowOnRelease,
			artistName: placement.album.artist?.name ?? '',
		})),
	};
}

async function main() {
	const now = new Date();
	const songs = await prisma.song.findMany({
		select: {
			id: true,
			title: true,
			isVisible: true,
			autoShowOnRelease: true,
			privateSoundcloudUrl: true,
			meta: {
				select: { releaseDate: true },
			},
			placements: {
				select: {
					album: {
						select: {
							id: true,
							title: true,
							releaseDate: true,
							isVisible: true,
							autoShowOnRelease: true,
							artist: {
								select: {
									name: true,
									slug: true,
									isVisible: true,
								},
							},
						},
					},
				},
			},
		},
		orderBy: { title: 'asc' },
	});

	const releasedWithPrivateSoundCloud = [];
	const futureScheduledToBecomePublic = [];
	const futureVisibilityBlocked = [];

	for (const song of songs) {
		const releaseDate = effectiveSongReleaseDate(song);
		if (!releaseDate) continue;

		const hasPrivateSoundCloudUrl = typeof song.privateSoundcloudUrl === 'string' && song.privateSoundcloudUrl.trim() !== '';
		if (hasPrivateSoundCloudUrl && isReleasedOnUtcDay(releaseDate, now)) {
			releasedWithPrivateSoundCloud.push(songSummary(song));
		}

		if (isReleasedOnUtcDay(releaseDate, now)) continue;

		const afterRelease = new Date(releaseDate.getTime() + AFTER_RELEASE_CHECK_OFFSET_MS);
		const isPublicNow = isSongEffectivelyPublic(song, now);
		const isPublicAfterRelease = isSongEffectivelyPublic(song, afterRelease);
		const summary = {
			...songSummary(song),
			isPublicNow,
			isPublicAfterRelease,
		};

		if (isPublicAfterRelease) {
			futureScheduledToBecomePublic.push(summary);
		} else {
			futureVisibilityBlocked.push(summary);
		}
	}

	const report = {
		checkedAt: now.toISOString(),
		counts: {
			songsChecked: songs.length,
			releasedWithPrivateSoundCloud: releasedWithPrivateSoundCloud.length,
			futureScheduledToBecomePublic: futureScheduledToBecomePublic.length,
			futureVisibilityBlocked: futureVisibilityBlocked.length,
		},
		releasedWithPrivateSoundCloud,
		futureScheduledToBecomePublic,
		futureVisibilityBlocked,
	};

	console.log(JSON.stringify(report, null, 2));

	if (SHOULD_FAIL_ON_ISSUES && (releasedWithPrivateSoundCloud.length > 0 || futureVisibilityBlocked.length > 0)) {
		process.exitCode = 1;
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
