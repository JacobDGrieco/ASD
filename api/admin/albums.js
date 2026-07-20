/**
 * Admin CRUD for albums. Read access requires either `MUSIC_ALBUMS` or
 * `MUSIC_SONGS` page access (songs need to look up albums); writes require
 * `MUSIC_ALBUMS` and a non-viewer role. Results are scoped per session via
 * `artistScopedAlbumWhere` (full access for SUPER_ADMIN, own-artist-only for
 * ARTIST, live-visibility view for VIEWER).
 *
 * Every request (including plain GETs) first runs `syncAlbumReleaseVisibility`,
 * lazily flipping `isVisible` to true for any album whose `autoShowOnRelease` date
 * has passed — see `contentVisibility.js` for why the public site doesn't depend
 * on this sync having run. Duplicate-title+artist+release-date albums are rejected
 * with a 409, checked at the application layer (not a DB constraint), so it's
 * possible (though unlikely) for two concurrent creates to both succeed.
 *
 * Server-only (Vercel Function). Consumed by `AdminMusicAlbumsPage.jsx` and
 * (read-only) `AdminMusicSongsPage.jsx`/`AdminSongFormModal.jsx`.
 */
import { prisma } from '../../src/lib/prisma.js'
import { artistScopedAlbumWhere, canAccessAdminPage, isSuperAdmin, isViewer, requireAdmin } from '../../src/lib/auth.js'
import { ADMIN_PAGE_KEYS } from '../../src/lib/adminPageAccess.js'
import { normalizeVisibilityInput } from '../../src/lib/contentVisibility.js'
import { releaseVisibilityUpperBound } from '../../src/lib/releaseSchedule.js'
import { collectBlobPathnames, deleteRemovedBlobPathnames, deleteUnusedBlobPathnames } from '../../src/lib/blobCleanup.js'
import { clientImages, mergeLegacyImages, normalizeImageInput, primaryImageReference, toImageCreateManyData } from '../../src/lib/images.js'
import { MUSIC_RELEASE_LEGACY_LINK_FIELDS, legacyFieldsFromProfileLinks, normalizeProfileLinks, profileLinksForSource } from '../../src/lib/profileLinks.js'
import { OTHER_ARTIST_NAME, OTHER_ARTIST_OPTION_ID, OTHER_ARTIST_SLUG } from '../../src/lib/publicVisibility.js'
import { slugify } from '../../src/lib/slugify.js'
import { SONG_ROLES, sortMusicRoleEntries } from '../../src/lib/songRoles.js'

function withImages(album) {
  const images = clientImages(mergeLegacyImages(album.images, album.coverArt, {
    fallbackUsage: 'cover',
    altText: album.title,
    idPrefix: album.id,
  }))
  const primaryImage = images.find((image) => image.isPrimary) ?? images[0]
  return {
    ...album,
    links: profileLinksForSource(album, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
    coverArt: primaryImage?.previewUrl ?? album.coverArt,
    images,
    roles: Array.isArray(album.roles) ? album.roles : [],
  }
}

function withListImages(album) {
  const previewImage = album.images?.[0] ?? null
  const images = previewImage
    ? clientImages(mergeLegacyImages([previewImage], album.coverArt, {
        fallbackUsage: 'cover',
        altText: album.title,
        idPrefix: album.id,
      }))
    : []

  return {
    ...album,
    links: profileLinksForSource(album, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
    coverArt: images[0]?.previewUrl ?? album.coverArt,
    images,
    roles: Array.isArray(album.roles) ? album.roles : [],
    imageCount: album._count?.images ?? images.length,
  }
}

function includeAlbum() {
  return {
    artist: { select: { id: true, name: true, slug: true, isVisible: true } },
    images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  }
}

function includeAlbumList() {
  return {
    id: true,
    title: true,
    slug: true,
    isVisible: true,
    autoShowOnRelease: true,
    type: true,
    otherArtistName: true,
    coverArt: true,
    soundcloudUrl: true,
    spotifyUrl: true,
    appleMusicUrl: true,
    youtubeUrl: true,
    links: true,
    roles: true,
    releaseDate: true,
    artistId: true,
    artist: { select: { id: true, name: true, slug: true, isVisible: true } },
    images: {
      take: 1,
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
    },
    _count: {
      select: { images: true },
    },
  }
}

// Materializes the DB isVisible column for albums whose auto-show release date has
// passed. Runs on every request to this endpoint (including GETs) rather than on a
// schedule — see contentVisibility.js's module header for why public reads don't
// actually depend on this having run, but admin list views showing the raw column
// benefit from it being reasonably fresh.
async function syncAlbumReleaseVisibility() {
  await prisma.album.updateMany({
    where: {
      isVisible: false,
      autoShowOnRelease: true,
      releaseDate: {
        lt: releaseVisibilityUpperBound(),
      },
    },
    data: {
      isVisible: true,
      autoShowOnRelease: false,
    },
  })
}

function normalizeAlbumDuplicateValue(value) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeAlbumReleaseDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function normalizedRoleName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizeExternalUrl(value) {
  const url = typeof value === 'string' ? value.trim() : ''
  if (!url) return ''

  try {
    const parsed = new URL(url.includes('://') ? url : `https://${url}`)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : ''
  } catch {
    return ''
  }
}

async function normalizeLinkedRoleInput(roles) {
  if (!Array.isArray(roles)) return []

  const inputRoles = roles.reduce((normalized, roleEntry) => {
    if (!SONG_ROLES.includes(roleEntry.role)) return normalized
    if (typeof roleEntry.name !== 'string') return normalized

    const name = roleEntry.name.trim().replace(/\s+/g, ' ')
    if (!name) return normalized

    normalized.push({
      role: roleEntry.role,
      name,
      artistId: typeof roleEntry.artistId === 'string' ? roleEntry.artistId : '',
      outsideArtistId: typeof roleEntry.outsideArtistId === 'string' ? roleEntry.outsideArtistId : '',
      externalUrl: normalizeExternalUrl(roleEntry.externalUrl),
      applyToSongs: roleEntry.applyToSongs !== false,
    })
    return normalized
  }, [])

  if (!inputRoles.length) return []

  const artistIds = [...new Set(inputRoles.flatMap((entry) => (entry.artistId ? [entry.artistId] : [])))]
  const outsideArtistIds = [...new Set(inputRoles.flatMap((entry) => (entry.outsideArtistId ? [entry.outsideArtistId] : [])))]
  const names = [...new Set(inputRoles.map((entry) => entry.name))]

  const [artists, outsideArtists] = await Promise.all([
    prisma.artist.findMany({
      where: {
        OR: [
          ...(artistIds.length ? [{ id: { in: artistIds } }] : []),
          ...names.map((name) => ({ name: { equals: name, mode: 'insensitive' } })),
        ],
      },
      select: { id: true, name: true },
    }),
    prisma.musicOutsideArtist.findMany({
      where: {
        OR: [
          ...(outsideArtistIds.length ? [{ id: { in: outsideArtistIds } }] : []),
          ...names.map((name) => ({ name: { equals: name, mode: 'insensitive' } })),
        ],
      },
      select: { id: true, name: true, role: true, externalUrl: true },
    }),
  ])

  const artistsById = new Map(artists.map((artist) => [artist.id, artist]))
  const artistsByName = new Map(artists.map((artist) => [normalizedRoleName(artist.name), artist]))
  const outsideArtistsById = new Map(outsideArtists.map((artist) => [artist.id, artist]))
  const outsideArtistsByName = new Map(outsideArtists.map((artist) => [normalizedRoleName(artist.name), artist]))
  const toCreateByKey = new Map()

  for (const entry of inputRoles) {
    if (entry.artistId && artistsById.has(entry.artistId)) continue
    if (entry.outsideArtistId && outsideArtistsById.has(entry.outsideArtistId)) continue
    const nameKey = normalizedRoleName(entry.name)
    if (artistsByName.has(nameKey)) continue
    if (outsideArtistsByName.has(nameKey)) continue
    if (!toCreateByKey.has(nameKey)) toCreateByKey.set(nameKey, entry)
  }

  const createdArtists = await Promise.all(
    [...toCreateByKey.values()].map((entry) =>
      prisma.musicOutsideArtist.create({
        data: { name: entry.name, role: entry.role, externalUrl: entry.externalUrl },
        select: { id: true, name: true, externalUrl: true },
      })
    )
  )
  const createdByKey = new Map([...toCreateByKey.keys()].map((key, index) => [key, createdArtists[index]]))

  return sortMusicRoleEntries(inputRoles.map((entry) => {
    const artistById = entry.artistId ? artistsById.get(entry.artistId) : null
    if (artistById) return { role: entry.role, name: artistById.name, artistId: artistById.id, applyToSongs: entry.applyToSongs }

    const outsideArtistById = entry.outsideArtistId ? outsideArtistsById.get(entry.outsideArtistId) : null
    if (outsideArtistById) {
      return {
        role: entry.role,
        name: outsideArtistById.name,
        outsideArtistId: outsideArtistById.id,
        externalUrl: outsideArtistById.externalUrl,
        applyToSongs: entry.applyToSongs,
      }
    }

    const nameKey = normalizedRoleName(entry.name)
    const artistByName = artistsByName.get(nameKey)
    if (artistByName) return { role: entry.role, name: artistByName.name, artistId: artistByName.id, applyToSongs: entry.applyToSongs }

    const outsideArtistByName = outsideArtistsByName.get(nameKey) ?? createdByKey.get(nameKey)
    return {
      role: entry.role,
      name: outsideArtistByName.name,
      outsideArtistId: outsideArtistByName.id,
      externalUrl: outsideArtistByName.externalUrl,
      applyToSongs: entry.applyToSongs,
    }
  }))
}

// Duplicate check is title + artist + release date + "other artist" name (for
// compilation albums), case/whitespace-insensitive. Excludes `id` itself so
// updating an album doesn't flag it as a duplicate of its own prior state.
async function findDuplicateAlbum({ id, title, releaseDate, resolvedArtistId, otherArtistName }) {
  const candidates = await prisma.album.findMany({
    where: {
      ...(id ? { id: { not: id } } : {}),
      artistId: resolvedArtistId,
    },
    select: {
      id: true,
      title: true,
      releaseDate: true,
      otherArtistName: true,
    },
  })

  const normalizedTitle = normalizeAlbumDuplicateValue(title)
  const normalizedOtherArtistName = normalizeAlbumDuplicateValue(otherArtistName)
  const normalizedReleaseDate = normalizeAlbumReleaseDate(releaseDate)

  return candidates.find((album) => (
    normalizeAlbumDuplicateValue(album.title) === normalizedTitle &&
    normalizeAlbumDuplicateValue(album.otherArtistName) === normalizedOtherArtistName &&
    normalizeAlbumReleaseDate(album.releaseDate) === normalizedReleaseDate
  )) ?? null
}

function buildAlbumSlug({ title, artistSlugPart, releaseDate }) {
  const slugParts = [title]

  if (artistSlugPart) slugParts.push(artistSlugPart)

  if (releaseDate) slugParts.push(normalizeAlbumReleaseDate(releaseDate))

  return slugify(slugParts.filter(Boolean).join('-'))
}

async function loadAlbumForSession(session, id) {
  return prisma.album.findFirst({
    where: {
      id,
      ...artistScopedAlbumWhere(session),
    },
    include: includeAlbum(),
  })
}

// ARTIST-role sessions are always pinned to their own artist. Super admins can
// additionally save an album under the reserved "Other" pseudo-artist
// (OTHER_ARTIST_OPTION_ID is a client-side sentinel), lazily creating that Artist
// row the first time it's used — same pattern as the board's ASD-Records artist.
async function resolveAlbumArtistId(session, artistId) {
  if (!isSuperAdmin(session)) return session.artistId
  if (!artistId) return null
  if (artistId !== OTHER_ARTIST_OPTION_ID) return artistId

  const otherArtist = await prisma.artist.upsert({
    where: { slug: OTHER_ARTIST_SLUG },
    update: { name: OTHER_ARTIST_NAME },
    create: {
      name: OTHER_ARTIST_NAME,
      slug: OTHER_ARTIST_SLUG,
      order: 999999,
    },
    select: { id: true },
  })

  return otherArtist.id
}

async function resolveAlbumArtistSlugPart(artistId, otherArtistName, resolvedArtistId) {
  if (artistId === OTHER_ARTIST_OPTION_ID) return otherArtistName?.trim() || OTHER_ARTIST_NAME
  if (!resolvedArtistId) return ''

  const artist = await prisma.artist.findUnique({
    where: { id: resolvedArtistId },
    select: { slug: true },
  })

  return artist?.slug ?? resolvedArtistId
}

function roleSyncKey(role) {
  const personKey = role.artistId
    ? `artist:${role.artistId}`
    : role.outsideArtistId
      ? `outside:${role.outsideArtistId}`
      : `name:${String(role.name ?? '').trim().toLowerCase()}`
  return `${role.role}:${personKey}`
}

function songRoleCopy(role) {
  return {
    role: role.role,
    name: role.name,
    ...(role.artistId ? { artistId: role.artistId } : {}),
    ...(role.outsideArtistId ? { outsideArtistId: role.outsideArtistId } : {}),
    ...(role.externalUrl ? { externalUrl: role.externalUrl } : {}),
  }
}

function albumRolesToCopy(previousRoles, nextRoles) {
  const previousByKey = new Map()
  for (const role of Array.isArray(previousRoles) ? previousRoles : []) {
    if (role?.role && role?.name) previousByKey.set(roleSyncKey(role), role)
  }

  return (Array.isArray(nextRoles) ? nextRoles : []).filter((role) => {
    if (!role?.role || !role?.name || role.applyToSongs === false) return false
    const previousRole = previousByKey.get(roleSyncKey(role))
    return !previousRole || previousRole.applyToSongs === false
  })
}

function mergeSongRoles(songRoles, rolesToCopy) {
  const merged = []
  const seen = new Set()

  for (const role of Array.isArray(songRoles) ? songRoles : []) {
    if (!role?.role || !role?.name) continue
    const key = roleSyncKey(role)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(songRoleCopy(role))
  }

  for (const role of Array.isArray(rolesToCopy) ? rolesToCopy : []) {
    if (!role?.role || !role?.name) continue
    const key = roleSyncKey(role)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(songRoleCopy(role))
  }

  return sortMusicRoleEntries(merged)
}

async function copyAlbumRolesToAttachedSongs(albumId, rolesToCopy) {
  if (!rolesToCopy.length) return

  const metas = await prisma.songMeta.findMany({
    where: {
      song: {
        placements: {
          some: { albumId },
        },
      },
    },
    select: {
      songId: true,
      roles: true,
    },
  })
  const songIdsWithMeta = new Set(metas.map((meta) => meta.songId))
  const placements = await prisma.songAlbum.findMany({
    where: { albumId },
    select: { songId: true },
  })
  const songIds = [...new Set(placements.map((placement) => placement.songId))]
  if (!songIds.length) return

  await Promise.all([
    ...metas.flatMap((meta) => {
      const nextRoles = mergeSongRoles(meta.roles, rolesToCopy)
      if (nextRoles.length === (Array.isArray(meta.roles) ? meta.roles.length : 0)) return []
      return [prisma.songMeta.update({
        where: { songId: meta.songId },
        data: { roles: nextRoles },
      })]
    }),
    ...songIds.flatMap((songId) => (
      songIdsWithMeta.has(songId)
        ? []
        : [prisma.songMeta.create({
            data: {
              songId,
              roles: rolesToCopy.map(songRoleCopy),
            },
          })]
    )),
  ])
}

async function syncSingleSongsFromAlbum(albumId, type, links) {
  if (String(type ?? '').toUpperCase() !== 'SINGLE') return

  const placements = await prisma.songAlbum.findMany({
    where: { albumId },
    select: { songId: true },
  })
  const songIds = [...new Set(placements.map((placement) => placement.songId))]
  if (!songIds.length) return

  await prisma.song.updateMany({
    where: { id: { in: songIds } },
    data: {
      links,
      ...legacyFieldsFromProfileLinks(links, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
    },
  })
}

export default async function handler(req, res) {
  const session = requireAdmin(req, res)
  if (!session) return
  const canReadAlbums = [
    ADMIN_PAGE_KEYS.MUSIC_ALBUMS,
    ADMIN_PAGE_KEYS.MUSIC_SONGS,
  ].some((pageKey) => canAccessAdminPage(session, pageKey))
  if (!canReadAlbums) return res.status(403).json({ error: 'Forbidden' })
  await syncAlbumReleaseVisibility()

  const { id } = req.query

  if (id) {
    const existingAlbum = await loadAlbumForSession(session, id)
    if (!existingAlbum) return res.status(404).json({ error: 'Album not found' })

    if (req.method === 'GET') {
      return res.status(200).json(withImages(existingAlbum))
    }

    if (req.method === 'PUT') {
      if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.MUSIC_ALBUMS)) return res.status(403).json({ error: 'Forbidden' })
      if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
      const { title, type, otherArtistName, aboutText, soundcloudUrl, spotifyUrl, appleMusicUrl, youtubeUrl, links, roles, releaseDate, artistId, images } = req.body
      const resolvedArtistId = await resolveAlbumArtistId(session, artistId)
      if (!resolvedArtistId) return res.status(400).json({ error: 'Artist is required.' })
      const duplicateAlbum = await findDuplicateAlbum({ id, title, releaseDate, resolvedArtistId, otherArtistName: artistId === OTHER_ARTIST_OPTION_ID ? otherArtistName : '' })
      if (duplicateAlbum) {
        return res.status(409).json({ error: 'An album with this title, artist, and release date already exists.' })
      }
      const artistSlugPart = await resolveAlbumArtistSlugPart(artistId, otherArtistName, resolvedArtistId)
      const normalizedImages = normalizeImageInput(images, 'cover')
      const normalizedLinks = links === undefined ? profileLinksForSource(req.body, MUSIC_RELEASE_LEGACY_LINK_FIELDS) : normalizeProfileLinks(links)
      const normalizedRoles = await normalizeLinkedRoleInput(roles)
      const legacyLinkFields = legacyFieldsFromProfileLinks(normalizedLinks, MUSIC_RELEASE_LEGACY_LINK_FIELDS)
      const visibility = normalizeVisibilityInput({
        isVisible: req.body.isVisible,
        autoShowOnRelease: req.body.autoShowOnRelease,
        releaseDate,
      })
      const album = await prisma.album.update({
        where: { id },
        data: {
          title,
          slug: buildAlbumSlug({ title, artistSlugPart, releaseDate }),
          isVisible: visibility.isVisible,
          autoShowOnRelease: visibility.autoShowOnRelease,
          type,
          otherArtistName: artistId === OTHER_ARTIST_OPTION_ID ? otherArtistName?.trim() || null : null,
          coverArt: primaryImageReference(normalizedImages),
          aboutText: aboutText ?? '',
          soundcloudUrl: soundcloudUrl || null,
          spotifyUrl: spotifyUrl || null,
          appleMusicUrl: appleMusicUrl || null,
          youtubeUrl: youtubeUrl || null,
          links: normalizedLinks,
          roles: normalizedRoles,
          ...legacyLinkFields,
          releaseDate: new Date(releaseDate),
          artistId: resolvedArtistId,
          images: {
            deleteMany: {},
            createMany: {
              data: toImageCreateManyData(normalizedImages),
            },
          },
        },
        include: includeAlbum(),
      })
      await syncSingleSongsFromAlbum(album.id, album.type, normalizedLinks)
      await copyAlbumRolesToAttachedSongs(album.id, albumRolesToCopy(existingAlbum.roles, normalizedRoles))
      await deleteRemovedBlobPathnames([existingAlbum.images, existingAlbum.coverArt], normalizedImages)
      return res.status(200).json(withImages(album))
    }

    if (req.method === 'DELETE') {
      if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.MUSIC_ALBUMS)) return res.status(403).json({ error: 'Forbidden' })
      if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
      const blobPathnames = collectBlobPathnames(existingAlbum.images, existingAlbum.coverArt)
      await prisma.album.delete({ where: { id } })
      await deleteUnusedBlobPathnames(blobPathnames)
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const albums = await prisma.album.findMany({
      where: artistScopedAlbumWhere(session),
      orderBy: { releaseDate: 'desc' },
      select: includeAlbumList(),
    })
    return res.status(200).json(albums.map(withListImages))
  }

  if (req.method === 'POST') {
    if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.MUSIC_ALBUMS)) return res.status(403).json({ error: 'Forbidden' })
    if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
    const { title, type, otherArtistName, aboutText, soundcloudUrl, spotifyUrl, appleMusicUrl, youtubeUrl, links, roles, releaseDate, artistId, images } = req.body
    const resolvedArtistId = await resolveAlbumArtistId(session, artistId)
    if (!resolvedArtistId) return res.status(400).json({ error: 'Artist is required.' })
    const duplicateAlbum = await findDuplicateAlbum({ title, releaseDate, resolvedArtistId, otherArtistName: artistId === OTHER_ARTIST_OPTION_ID ? otherArtistName : '' })
    if (duplicateAlbum) {
      return res.status(409).json({ error: 'An album with this title, artist, and release date already exists.' })
    }
    const artistSlugPart = await resolveAlbumArtistSlugPart(artistId, otherArtistName, resolvedArtistId)
    const normalizedImages = normalizeImageInput(images, 'cover')
    const normalizedLinks = links === undefined ? profileLinksForSource(req.body, MUSIC_RELEASE_LEGACY_LINK_FIELDS) : normalizeProfileLinks(links)
    const normalizedRoles = await normalizeLinkedRoleInput(roles)
    const legacyLinkFields = legacyFieldsFromProfileLinks(normalizedLinks, MUSIC_RELEASE_LEGACY_LINK_FIELDS)
    const visibility = normalizeVisibilityInput({
      isVisible: req.body.isVisible,
      autoShowOnRelease: req.body.autoShowOnRelease,
      releaseDate,
    })
    const album = await prisma.album.create({
      data: {
        title,
        slug: buildAlbumSlug({ title, artistSlugPart, releaseDate }),
        isVisible: visibility.isVisible,
        autoShowOnRelease: visibility.autoShowOnRelease,
        type,
        otherArtistName: artistId === OTHER_ARTIST_OPTION_ID ? otherArtistName?.trim() || null : null,
        coverArt: primaryImageReference(normalizedImages),
        aboutText: aboutText ?? '',
        soundcloudUrl: soundcloudUrl || null,
        spotifyUrl: spotifyUrl || null,
        appleMusicUrl: appleMusicUrl || null,
        youtubeUrl: youtubeUrl || null,
        links: normalizedLinks,
        roles: normalizedRoles,
        ...legacyLinkFields,
        releaseDate: new Date(releaseDate),
        artistId: resolvedArtistId,
        images: normalizedImages.length
          ? {
              createMany: {
                data: toImageCreateManyData(normalizedImages),
              },
            }
          : undefined,
      },
      include: includeAlbum(),
    })
    await syncSingleSongsFromAlbum(album.id, album.type, normalizedLinks)
    return res.status(201).json(withImages(album))
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
