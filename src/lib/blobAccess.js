/**
 * Read authorization for proxied Vercel Blob images.
 *
 * Admin requests may read any managed blob pathname. Anonymous public requests are
 * limited to pathnames referenced by content that is currently public according to
 * the same release/visibility model used by `api/public.js`.
 */
import { readAdminTokenFromRequest, verifyToken } from './auth.js';
import { blobPathnameFromReference } from './blobCleanup.js';
import { prisma } from './prisma.js';
import { OTHER_ARTIST_SLUG, ASD_RECORDS_ARTIST_SLUG } from './publicVisibility.js';
import { releaseVisibilityUpperBound } from './releaseSchedule.js';

const RESERVED_ARTIST_SLUGS = [OTHER_ARTIST_SLUG, ASD_RECORDS_ARTIST_SLUG];

function hasAdminBlobReadAccess(req) {
	const token = readAdminTokenFromRequest(req);
	return Boolean(token && verifyToken(token));
}

function releasedVisibilityWhere(dateField, upperBound) {
	return {
		[dateField]: { lt: upperBound },
		OR: [
			{ isVisible: true },
			{ autoShowOnRelease: true },
		],
	};
}

function publicArtistWhere() {
	return {
		isVisible: true,
		slug: { notIn: RESERVED_ARTIST_SLUGS },
	};
}

function publicAlbumWhere(upperBound) {
	return {
		...releasedVisibilityWhere('releaseDate', upperBound),
		artist: publicArtistWhere(),
	};
}

function publicSongWhere(upperBound) {
	return {
		AND: [
			{
				OR: [
					{ isVisible: true },
					{ autoShowOnRelease: true },
				],
			},
			{
				OR: [
					{ meta: { is: null } },
					{ meta: { is: { releaseDate: null } } },
					{ meta: { is: { releaseDate: { lt: upperBound } } } },
				],
			},
			{
				placements: {
					some: {
						album: publicAlbumWhere(upperBound),
					},
				},
			},
		],
	};
}

function publicBoardPostWhere(pathname, now) {
	const ageCap = new Date(now);
	ageCap.setDate(ageCap.getDate() - 90);

	return {
		publishedAt: { not: null, lte: now },
		archivedAt: null,
		OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
		AND: [
			{ publishedAt: { gte: ageCap } },
			{
				OR: [
					{ imageUrl: { contains: pathname } },
					{ body: { contains: pathname } },
				],
			},
		],
		artist: {
			isVisible: true,
			slug: { not: OTHER_ARTIST_SLUG },
		},
	};
}

async function isPublicBlobPathnameReferenced(pathname, now = new Date()) {
	const upperBound = releaseVisibilityUpperBound(now);
	const publicAlbum = publicAlbumWhere(upperBound);
	const publicSong = publicSongWhere(upperBound);

	const counts = await Promise.all([
		prisma.artistImage.count({
			where: { pathname, artist: publicArtistWhere() },
		}),
		prisma.albumImage.count({
			where: { pathname, album: publicAlbum },
		}),
		prisma.songImage.count({
			where: { pathname, song: publicSong },
		}),
		prisma.companyMember.count({
			where: { imagePathname: pathname, isVisible: true },
		}),
		prisma.musicOutsideArtist.count({
			where: { pathname },
		}),
		prisma.artistVideo.count({
			where: { posterPathname: pathname, artist: publicArtistWhere() },
		}),
		prisma.crosshairVideo.count({
			where: { thumbnailPathname: pathname, isVisible: true },
		}),
		prisma.fashionTalentImage.count({
			where: { pathname, talent: { isVisible: true } },
		}),
		prisma.fashionCollection.count({
			where: { coverPathname: pathname, isVisible: true },
		}),
		prisma.fashionLookImage.count({
			where: { pathname, look: { isVisible: true } },
		}),
		prisma.fashionPiece.count({
			where: { pathname, look: { isVisible: true } },
		}),
		prisma.fashionCrew.count({
			where: { pathname },
		}),
		prisma.boardPost.count({
			where: publicBoardPostWhere(pathname, now),
		}),
		prisma.artist.count({
			where: { portrait: { contains: pathname }, ...publicArtistWhere() },
		}),
		prisma.album.count({
			where: { coverArt: { contains: pathname }, ...publicAlbum },
		}),
		prisma.song.count({
			where: { artwork: { contains: pathname }, ...publicSong },
		}),
	]);

	return counts.some((count) => count > 0);
}

export async function canReadBlobPathname(req, value) {
	const pathname = blobPathnameFromReference(value);
	if (!pathname) return { canRead: false, pathname: '' };
	if (hasAdminBlobReadAccess(req)) return { canRead: true, pathname };

	return {
		canRead: await isPublicBlobPathnameReferenced(pathname),
		pathname,
	};
}
