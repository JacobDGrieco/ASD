import fs from 'node:fs';
import path from 'node:path';
import { sortMusicRoleEntries } from '../src/lib/songRoles.js';

function loadDotEnvLocal() {
	const envPath = path.resolve(process.cwd(), '.env.local');
	if (!fs.existsSync(envPath)) return;

	for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
		if (!line || /^\s*#/.test(line) || !line.includes('=')) continue;
		const [rawKey, ...valueParts] = line.split('=');
		const key = rawKey.trim();
		if (!key || process.env[key]) continue;

		let value = valueParts.join('=').trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		process.env[key] = value;
	}
}

function roleKey(role) {
	const personKey = role.artistId
		? `artist:${role.artistId}`
		: role.outsideArtistId
			? `outside:${role.outsideArtistId}`
			: `name:${String(role.name ?? '').trim().toLowerCase()}`;
	return `${role.role}:${personKey}`;
}

function normalizedRole(role, extra = {}) {
	return {
		role: role.role,
		name: String(role.name).trim(),
		...(role.artistId ? { artistId: role.artistId } : {}),
		...(role.outsideArtistId ? { outsideArtistId: role.outsideArtistId } : {}),
		...(role.externalUrl ? { externalUrl: role.externalUrl } : {}),
		...(extra.omitApplyToSongs
			? {}
			: extra.applyToSongs !== undefined
				? { applyToSongs: extra.applyToSongs }
				: role.applyToSongs !== undefined
					? { applyToSongs: role.applyToSongs !== false }
					: {}),
	};
}

function mergeAlbumRoles(albumRoles, ...songRoleSets) {
	const merged = [];
	const seen = new Set();

	for (const role of Array.isArray(albumRoles) ? albumRoles : []) {
		if (!role?.role || !role?.name) continue;
		const key = roleKey(role);
		if (seen.has(key)) continue;
		seen.add(key);
		merged.push(normalizedRole(role, { applyToSongs: role.applyToSongs !== false }));
	}

	for (const roleSet of songRoleSets) {
		for (const role of Array.isArray(roleSet) ? roleSet : []) {
			if (!role?.role || !role?.name) continue;
			const key = roleKey(role);
			if (seen.has(key)) continue;
			seen.add(key);
			merged.push(normalizedRole(role, { applyToSongs: true }));
		}
	}

	return sortMusicRoleEntries(merged);
}

function normalizeSongRoles(roles) {
	const merged = [];
	const seen = new Set();

	for (const role of Array.isArray(roles) ? roles : []) {
		if (!role?.role || !role?.name) continue;
		const key = roleKey(role);
		if (seen.has(key)) continue;
		seen.add(key);
		merged.push(normalizedRole(role, { omitApplyToSongs: true }));
	}

	return sortMusicRoleEntries(merged);
}

function copyAlbumRolesToSongRoles(songRoles, albumRoles) {
	const merged = normalizeSongRoles(songRoles);
	const seen = new Set(merged.map(roleKey));

	for (const role of Array.isArray(albumRoles) ? albumRoles : []) {
		if (!role?.role || !role?.name || role.applyToSongs === false) continue;
		const key = roleKey(role);
		if (seen.has(key)) continue;
		seen.add(key);
		merged.push(normalizedRole(role, { omitApplyToSongs: true }));
	}

	return merged;
}

function linkKey(link) {
	return `${link.platform}:${link.type}:${String(link.url ?? '').trim()}`;
}

function mergeLinks(normalizeProfileLinks, ...linkSets) {
	const merged = [];
	const seen = new Set();

	for (const linkSet of linkSets) {
		for (const link of normalizeProfileLinks(linkSet)) {
			const key = linkKey(link);
			if (seen.has(key)) continue;
			seen.add(key);
			merged.push(link);
		}
	}

	return normalizeProfileLinks(merged);
}

function linksEqual(left, right, normalizeProfileLinks) {
	return JSON.stringify(normalizeProfileLinks(left)) === JSON.stringify(normalizeProfileLinks(right));
}

function rolesEqual(left, right) {
	return JSON.stringify(normalizeSongRoles(left)) === JSON.stringify(normalizeSongRoles(right));
}

function albumRolesEqual(left, right) {
	return JSON.stringify(mergeAlbumRoles(left)) === JSON.stringify(mergeAlbumRoles(right));
}

async function main() {
	loadDotEnvLocal();

	const dryRun = process.argv.includes('--dry-run');
	const { prisma } = await import('../src/lib/prisma.js');
	const {
		MUSIC_RELEASE_LEGACY_LINK_FIELDS,
		legacyFieldsFromProfileLinks,
		normalizeProfileLinks,
		profileLinksForSource,
	} = await import('../src/lib/profileLinks.js');

	const singleAlbums = await prisma.album.findMany({
		where: {
			type: 'SINGLE',
			songPlacements: {
				some: {},
			},
		},
		include: {
			songPlacements: {
				orderBy: [{ placementOrder: 'asc' }, { trackNumber: 'asc' }],
				include: {
					song: {
						select: {
							id: true,
							title: true,
							soundcloudUrl: true,
							spotifyUrl: true,
							appleMusicUrl: true,
							youtubeUrl: true,
							links: true,
							meta: {
								select: {
									roles: true,
								},
							},
						},
					},
				},
			},
		},
	});

	const summary = {
		singleAlbums: singleAlbums.length,
		nonSingleAlbumsWithSongs: 0,
		albumsUpdated: 0,
		songsUpdated: 0,
		songMetasUpdated: 0,
		albumRoleCopySongMetasUpdated: 0,
	};

	for (const album of singleAlbums) {
		const songs = album.songPlacements.map((placement) => placement.song).filter(Boolean);
		const sharedLinks = mergeLinks(
			normalizeProfileLinks,
			profileLinksForSource(album, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
			...songs.map((song) => profileLinksForSource(song, MUSIC_RELEASE_LEGACY_LINK_FIELDS))
		);
		const sharedRoles = mergeAlbumRoles(
			album.roles,
			...songs.map((song) => song.meta?.roles)
		);

		const albumNeedsUpdate = !linksEqual(album.links, sharedLinks, normalizeProfileLinks) || !albumRolesEqual(album.roles, sharedRoles);
		if (albumNeedsUpdate) {
			summary.albumsUpdated += 1;
			if (!dryRun) {
				await prisma.album.update({
					where: { id: album.id },
					data: {
						links: sharedLinks,
						roles: sharedRoles,
						...legacyFieldsFromProfileLinks(sharedLinks, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
					},
				});
			}
		}

		for (const song of songs) {
			const songNeedsLinkUpdate = !linksEqual(song.links, sharedLinks, normalizeProfileLinks);
			const copiedSongRoles = copyAlbumRolesToSongRoles(song.meta?.roles, sharedRoles);
			const songNeedsRoleUpdate = !rolesEqual(song.meta?.roles, copiedSongRoles);

			if (songNeedsLinkUpdate) {
				summary.songsUpdated += 1;
				if (!dryRun) {
					await prisma.song.update({
						where: { id: song.id },
						data: {
							links: sharedLinks,
							...legacyFieldsFromProfileLinks(sharedLinks, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
						},
					});
				}
			}

			if (songNeedsRoleUpdate) {
				summary.songMetasUpdated += 1;
				if (!dryRun) {
					await prisma.songMeta.upsert({
						where: { songId: song.id },
						create: {
							songId: song.id,
							roles: copiedSongRoles,
						},
						update: {
							roles: copiedSongRoles,
						},
					});
				}
			}
		}
	}

	const nonSingleAlbums = await prisma.album.findMany({
		where: {
			type: { not: 'SINGLE' },
			songPlacements: {
				some: {},
			},
		},
		include: {
			songPlacements: {
				include: {
					song: {
						select: {
							id: true,
							meta: {
								select: {
									roles: true,
								},
							},
						},
					},
				},
			},
		},
	});
	summary.nonSingleAlbumsWithSongs = nonSingleAlbums.length;

	for (const album of nonSingleAlbums) {
		const albumRolesToCopy = (Array.isArray(album.roles) ? album.roles : [])
			.filter((role) => role?.role && role?.name && role.applyToSongs !== false);
		if (!albumRolesToCopy.length) continue;

		for (const placement of album.songPlacements) {
			const song = placement.song;
			if (!song) continue;
			const copiedSongRoles = copyAlbumRolesToSongRoles(song.meta?.roles, albumRolesToCopy);
			if (rolesEqual(song.meta?.roles, copiedSongRoles)) continue;

			summary.albumRoleCopySongMetasUpdated += 1;
			if (!dryRun) {
				await prisma.songMeta.upsert({
					where: { songId: song.id },
					create: {
						songId: song.id,
						roles: copiedSongRoles,
					},
					update: {
						roles: copiedSongRoles,
					},
				});
			}
		}
	}

	await prisma.$disconnect();
	console.log(JSON.stringify({ dryRun, ...summary }, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
