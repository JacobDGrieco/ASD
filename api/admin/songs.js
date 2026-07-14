import { prisma } from '../../src/lib/prisma.js'
import { artistScopedSongWhere, canAccessAdminPage, isSuperAdmin, isViewer, requireAdmin } from '../../src/lib/auth.js'
import { ADMIN_PAGE_KEYS } from '../../src/lib/adminPageAccess.js'
import { normalizeVisibilityInput } from '../../src/lib/contentVisibility.js'
import { releaseVisibilityUpperBound } from '../../src/lib/releaseSchedule.js'
import { slugify } from '../../src/lib/slugify.js'
import {
  clientImages,
  mergeLegacyImages,
  normalizeImageInput,
  primaryImageReference,
  toImageCreateManyData,
} from '../../src/lib/images.js'
import { MUSIC_RELEASE_LEGACY_LINK_FIELDS, legacyFieldsFromProfileLinks, normalizeProfileLinks, profileLinksForSource } from '../../src/lib/profileLinks.js'
import { isOtherArtist, OTHER_ARTIST_NAME } from '../../src/lib/publicVisibility.js'
import { SONG_ROLES } from '../../src/lib/songRoles.js'

function withImages(song) {
  const images = clientImages(
    mergeLegacyImages(song.images, song.artwork, {
      fallbackUsage: 'artwork',
      altText: song.title,
      idPrefix: song.id,
    })
  )

  return {
    ...song,
    links: profileLinksForSource(song, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
    artwork: images[0]?.previewUrl ?? song.artwork,
    images,
  }
}

function withListImages(song) {
  const previewImage = song.images?.[0] ?? null
  const images = previewImage
    ? clientImages(
        mergeLegacyImages([previewImage], song.artwork, {
          fallbackUsage: 'artwork',
          altText: song.title,
          idPrefix: song.id,
        })
      )
    : []

  return {
    ...song,
    links: profileLinksForSource(song, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
    artwork: images[0]?.previewUrl ?? song.artwork,
    images,
    imageCount: song._count?.images ?? images.length,
  }
}

function normalizePlacements(input) {
  const albumIds = Array.isArray(input?.albumIds) ? input.albumIds : []
  const discNumbers = Array.isArray(input?.discNumbers) ? input.discNumbers : []
  const trackNumbers = Array.isArray(input?.trackNumbers) ? input.trackNumbers : []

  return albumIds.map((albumId, index) => ({
    albumId,
    discNumber: Number(discNumbers[index] ?? 1),
    trackNumber: Number(trackNumbers[index] ?? 0),
    placementOrder: index,
  }))
}

function validatePlacements(placements) {
  if (!placements.length) return 'At least one album is required.'

  const albumIds = new Set()
  for (const placement of placements) {
    if (!placement.albumId) return 'Each album card must have an album selected.'
    if (albumIds.has(placement.albumId)) return 'Each album can only be selected once per song.'
    if (!placement.trackNumber || placement.trackNumber < 1) return 'Track number must be at least 1 for each album card.'
    if (!placement.discNumber || placement.discNumber < 1) return 'Disc number must be at least 1 for each album card.'
    albumIds.add(placement.albumId)
  }

  return null
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
  // Pre-scan: find entries that need a new DB record, deduplicated by name
  const toCreateByKey = new Map()
  for (const entry of inputRoles) {
    if (entry.artistId && artistsById.has(entry.artistId)) continue
    if (entry.outsideArtistId && outsideArtistsById.has(entry.outsideArtistId)) continue
    const nameKey = normalizedRoleName(entry.name)
    if (artistsByName.has(nameKey)) continue
    if (outsideArtistsByName.has(nameKey)) continue
    if (!toCreateByKey.has(nameKey)) toCreateByKey.set(nameKey, entry)
  }

  // Create all new outside artists in parallel (no sequential awaits)
  const createdArtists = await Promise.all(
    [...toCreateByKey.values()].map((entry) =>
      prisma.musicOutsideArtist.create({
        data: { name: entry.name, role: entry.role, externalUrl: entry.externalUrl },
        select: { id: true, name: true, externalUrl: true },
      })
    )
  )
  const createdByKey = new Map([...toCreateByKey.keys()].map((key, i) => [key, createdArtists[i]]))

  // Build normalizedRoles in original input order
  const normalizedRoles = []
  for (const entry of inputRoles) {
    const artistById = entry.artistId ? artistsById.get(entry.artistId) : null
    if (artistById) {
      normalizedRoles.push({ role: entry.role, name: artistById.name, artistId: artistById.id })
      continue
    }

    const outsideArtistById = entry.outsideArtistId ? outsideArtistsById.get(entry.outsideArtistId) : null
    if (outsideArtistById) {
      normalizedRoles.push({
        role: entry.role,
        name: outsideArtistById.name,
        outsideArtistId: outsideArtistById.id,
        externalUrl: outsideArtistById.externalUrl,
      })
      continue
    }

    const nameKey = normalizedRoleName(entry.name)
    const artistByName = artistsByName.get(nameKey)
    if (artistByName) {
      normalizedRoles.push({ role: entry.role, name: artistByName.name, artistId: artistByName.id })
      continue
    }

    const outsideArtistByName = outsideArtistsByName.get(nameKey) ?? createdByKey.get(nameKey)
    normalizedRoles.push({
      role: entry.role,
      name: outsideArtistByName.name,
      outsideArtistId: outsideArtistByName.id,
      externalUrl: outsideArtistByName.externalUrl,
    })
  }

  return normalizedRoles
}

function normalizeSongDuplicateValue(value) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeSongReleaseDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function albumArtistKey(album) {
  if (!album) return ''
  if (isOtherArtist(album.artist)) {
    return `other:${normalizeSongDuplicateValue(album.otherArtistName || OTHER_ARTIST_NAME)}`
  }

  return `artist:${album.artistId ?? album.artist?.id ?? ''}`
}

async function loadPlacementAlbums(placements) {
  const albumIds = [...new Set(placements.flatMap((placement) => (placement.albumId ? [placement.albumId] : [])))]
  if (!albumIds.length) return []

  return prisma.album.findMany({
    where: {
      id: {
        in: albumIds,
      },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      otherArtistName: true,
      artistId: true,
      artist: {
        select: {
          id: true,
          slug: true,
          name: true,
          isVisible: true,
        },
      },
    },
  })
}

async function findDuplicateSong({ id, title, releaseDate, placements }) {
  const albumIds = [...new Set(placements.flatMap((placement) => (placement.albumId ? [placement.albumId] : [])))]
  if (!albumIds.length) return null

  const [candidates, placementAlbums] = await Promise.all([
    prisma.song.findMany({
      where: {
        ...(id ? { id: { not: id } } : {}),
        placements: {
          some: {
            albumId: {
              in: albumIds,
            },
          },
        },
      },
      include: {
        placements: {
          include: {
            album: {
              select: {
                id: true,
                title: true,
                otherArtistName: true,
                artistId: true,
                artist: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    isVisible: true,
                  },
                },
              },
            },
          },
        },
        meta: {
          select: {
            releaseDate: true,
          },
        },
      },
    }),
    loadPlacementAlbums(placements),
  ])
  const placementAlbumById = Object.fromEntries(placementAlbums.map((album) => [album.id, album]))
  const normalizedTitle = normalizeSongDuplicateValue(title)
  const normalizedReleaseDate = normalizeSongReleaseDate(releaseDate)

  return candidates.find((song) => {
    if (normalizeSongDuplicateValue(song.title) !== normalizedTitle) return false
    if (normalizeSongReleaseDate(song.meta?.releaseDate) !== normalizedReleaseDate) return false

    return song.placements.some((placement) => {
      const selectedAlbum = placementAlbumById[placement.albumId]
      if (!selectedAlbum) return false

      return (
        normalizeSongDuplicateValue(selectedAlbum.title) === normalizeSongDuplicateValue(placement.album?.title) &&
        albumArtistKey(selectedAlbum) === albumArtistKey(placement.album)
      )
    })
  }) ?? null
}

function buildSongSlug({ title, album, releaseDate }) {
  const slugParts = [title]

  if (album?.slug) slugParts.push(album.slug)
  else if (album?.title) slugParts.push(album.title)

  if (album?.artist?.slug) slugParts.push(album.artist.slug)
  else if (album?.artist?.name) slugParts.push(album.artist.name)

  if (releaseDate) slugParts.push(normalizeSongReleaseDate(releaseDate))

  return slugify(slugParts.filter(Boolean).join('-'))
}

function formatSong(song) {
  const placements = (song.placements ?? []).toSorted((left, right) => left.placementOrder - right.placementOrder)
  const primaryPlacement = placements[0] ?? null

  return withImages({
    ...song,
    placements,
    albumPlacements: placements.map((placement) => ({
      albumId: placement.albumId,
      trackNumber: placement.trackNumber,
      discNumber: placement.discNumber,
    })),
    albumIds: placements.map((placement) => placement.albumId),
    discNumbers: placements.map((placement) => placement.discNumber),
    trackNumbers: placements.map((placement) => placement.trackNumber),
    albumId: primaryPlacement?.albumId ?? '',
    trackNumber: primaryPlacement?.trackNumber ?? null,
    discNumber: primaryPlacement?.discNumber ?? null,
    album: primaryPlacement?.album ?? null,
  })
}

function songInclude() {
  return {
    placements: {
      orderBy: [{ placementOrder: 'asc' }],
      include: {
        album: {
          select: {
            id: true,
            title: true,
            slug: true,
            otherArtistName: true,
            releaseDate: true,
            artistId: true,
            artist: { select: { id: true, name: true, slug: true, order: true, isVisible: true } },
          },
        },
      },
    },
    meta: true,
    images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  }
}

function songListInclude() {
  return {
    placements: {
      orderBy: [{ placementOrder: 'asc' }],
      include: {
        album: {
          select: {
            id: true,
            title: true,
            slug: true,
            otherArtistName: true,
            releaseDate: true,
            artistId: true,
            artist: { select: { id: true, name: true, slug: true, order: true, isVisible: true } },
          },
        },
      },
    },
    meta: {
      select: {
        releaseDate: true,
      },
    },
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

function effectiveSongReleaseDate(song) {
  return song?.meta?.releaseDate ?? song?.placements?.[0]?.album?.releaseDate ?? null
}

async function syncSongReleaseVisibility() {
  const candidates = await prisma.song.findMany({
    where: {
      isVisible: false,
      autoShowOnRelease: true,
    },
    select: {
      id: true,
      meta: {
        select: {
          releaseDate: true,
        },
      },
      placements: {
        orderBy: [{ placementOrder: 'asc' }],
        take: 1,
        select: {
          album: {
            select: {
              releaseDate: true,
            },
          },
        },
      },
    },
  })

  const upperBound = releaseVisibilityUpperBound()
  const releasedIds = candidates.reduce((ids, song) => {
    const releaseDate = effectiveSongReleaseDate(song)
    if (releaseDate && new Date(releaseDate).getTime() < upperBound.getTime()) {
      ids.push(song.id)
    }
    return ids
  }, [])

  if (!releasedIds.length) return

  await prisma.song.updateMany({
    where: {
      id: {
        in: releasedIds,
      },
    },
    data: {
      isVisible: true,
      autoShowOnRelease: false,
    },
  })
}

async function loadSong(session, id) {
  const song = await prisma.song.findFirst({
    where: {
      id,
      ...artistScopedSongWhere(session),
    },
    include: songInclude(),
  })

  return song ? formatSong(song) : null
}

async function validatePlacementOwnership(session, placements) {
  if (isSuperAdmin(session)) return true

  const albums = await prisma.album.findMany({
    where: {
      id: {
        in: placements.map((placement) => placement.albumId),
      },
      artistId: session.artistId,
    },
    select: { id: true },
  })

  return albums.length === placements.length
}

export default async function handler(req, res) {
  const session = requireAdmin(req, res)
  if (!session) return
  if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.MUSIC_SONGS)) return res.status(403).json({ error: 'Forbidden' })
  await syncSongReleaseVisibility()

  const { id } = req.query

  if (id) {
    const existingSong = await loadSong(session, id)
    if (!existingSong) return res.status(404).json({ error: 'Song not found' })

    if (req.method === 'GET') {
      return res.status(200).json(existingSong)
    }

    if (req.method === 'PUT') {
      if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
      const {
        title,
        duration,
        soundcloudUrl,
        spotifyUrl,
        appleMusicUrl,
        youtubeUrl,
        links,
        aboutText,
        roles,
        releaseDate,
        images,
        tags,
        bpm,
        key,
      } = req.body
      const placements = normalizePlacements(req.body)
      const validationError = validatePlacements(placements)
      if (validationError) return res.status(400).json({ error: validationError })
      if (!(await validatePlacementOwnership(session, placements))) {
        return res.status(403).json({ error: 'You can only assign songs to your own albums.' })
      }
      const duplicateSong = await findDuplicateSong({ id, title, releaseDate, placements })
      if (duplicateSong) {
        return res.status(409).json({ error: 'A song with this title, album, artist, and release date already exists.' })
      }

      const normalizedImages = normalizeImageInput(images, 'artwork')
      const normalizedLinks = links === undefined ? profileLinksForSource(req.body, MUSIC_RELEASE_LEGACY_LINK_FIELDS) : normalizeProfileLinks(links)
      const legacyLinkFields = legacyFieldsFromProfileLinks(normalizedLinks, MUSIC_RELEASE_LEGACY_LINK_FIELDS)
      const placementAlbums = await loadPlacementAlbums(placements)
      const primaryAlbum = placementAlbums.find((album) => album.id === placements[0]?.albumId) ?? null
      const effectiveReleaseDate = releaseDate || primaryAlbum?.releaseDate || null
      const visibility = normalizeVisibilityInput({
        isVisible: req.body.isVisible,
        autoShowOnRelease: req.body.autoShowOnRelease,
        releaseDate: effectiveReleaseDate,
      })

      await prisma.song.update({
        where: { id },
        data: {
          title,
          slug: buildSongSlug({ title, album: primaryAlbum, releaseDate }),
          isVisible: visibility.isVisible,
          autoShowOnRelease: visibility.autoShowOnRelease,
          duration,
          artwork: primaryImageReference(normalizedImages),
          soundcloudUrl,
          spotifyUrl,
          appleMusicUrl,
          youtubeUrl,
          links: normalizedLinks,
          ...legacyLinkFields,
          images: {
            deleteMany: {},
            createMany: {
              data: toImageCreateManyData(normalizedImages),
            },
          },
          placements: {
            deleteMany: {},
            createMany: {
              data: placements,
            },
          },
        },
      })

      const normalizedRoles = await normalizeLinkedRoleInput(roles)

      await prisma.songMeta.upsert({
        where: { songId: id },
        create: {
          songId: id,
          aboutText: aboutText ?? '',
          roles: normalizedRoles,
          tags: Array.isArray(tags) ? tags : [],
          bpm: bpm ?? '',
          key: key ?? '',
          releaseDate: releaseDate ? new Date(releaseDate) : null,
        },
        update: {
          aboutText,
          roles: normalizedRoles,
          tags: Array.isArray(tags) ? tags : [],
          bpm: bpm ?? '',
          key: key ?? '',
          releaseDate: releaseDate ? new Date(releaseDate) : null,
        },
      })

      return res.status(200).json(await loadSong(session, id))
    }

    if (req.method === 'DELETE') {
      if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
      await prisma.song.delete({ where: { id } })
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const songs = await prisma.song.findMany({
      where: artistScopedSongWhere(session),
      include: songListInclude(),
    })

    const sortedSongs = songs
      .map((song) => withListImages(formatSong(song)))
      .sort((left, right) => {
        const leftArtistOrder = left.album?.artist?.order ?? Number.MAX_SAFE_INTEGER
        const rightArtistOrder = right.album?.artist?.order ?? Number.MAX_SAFE_INTEGER
        if (leftArtistOrder !== rightArtistOrder) return leftArtistOrder - rightArtistOrder

        const leftRelease = left.album?.releaseDate ? new Date(left.album.releaseDate).getTime() : 0
        const rightRelease = right.album?.releaseDate ? new Date(right.album.releaseDate).getTime() : 0
        if (leftRelease !== rightRelease) return rightRelease - leftRelease

        if ((left.discNumber ?? 0) !== (right.discNumber ?? 0)) return (left.discNumber ?? 0) - (right.discNumber ?? 0)
        if ((left.trackNumber ?? 0) !== (right.trackNumber ?? 0)) return (left.trackNumber ?? 0) - (right.trackNumber ?? 0)

        return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' })
      })

    return res.status(200).json(sortedSongs)
  }

  if (req.method === 'POST') {
    if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
    const {
      title,
      duration,
      soundcloudUrl,
      spotifyUrl,
      appleMusicUrl,
      youtubeUrl,
      links,
      aboutText,
      roles,
      releaseDate,
      images,
      tags,
      bpm,
      key,
    } = req.body
    const placements = normalizePlacements(req.body)
    const validationError = validatePlacements(placements)
    if (validationError) return res.status(400).json({ error: validationError })
    if (!(await validatePlacementOwnership(session, placements))) {
      return res.status(403).json({ error: 'You can only assign songs to your own albums.' })
    }
    const duplicateSong = await findDuplicateSong({ title, releaseDate, placements })
    if (duplicateSong) {
      return res.status(409).json({ error: 'A song with this title, album, artist, and release date already exists.' })
    }

    const normalizedImages = normalizeImageInput(images, 'artwork')
    const normalizedLinks = links === undefined ? profileLinksForSource(req.body, MUSIC_RELEASE_LEGACY_LINK_FIELDS) : normalizeProfileLinks(links)
    const legacyLinkFields = legacyFieldsFromProfileLinks(normalizedLinks, MUSIC_RELEASE_LEGACY_LINK_FIELDS)
    const placementAlbums = await loadPlacementAlbums(placements)
    const primaryAlbum = placementAlbums.find((album) => album.id === placements[0]?.albumId) ?? null
    const effectiveReleaseDate = releaseDate || primaryAlbum?.releaseDate || null
    const visibility = normalizeVisibilityInput({
      isVisible: req.body.isVisible,
      autoShowOnRelease: req.body.autoShowOnRelease,
      releaseDate: effectiveReleaseDate,
    })
    const song = await prisma.song.create({
      data: {
        title,
        slug: buildSongSlug({ title, album: primaryAlbum, releaseDate }),
        isVisible: visibility.isVisible,
        autoShowOnRelease: visibility.autoShowOnRelease,
        duration: duration ?? '',
        artwork: primaryImageReference(normalizedImages),
        soundcloudUrl,
        spotifyUrl,
        appleMusicUrl,
        youtubeUrl,
        links: normalizedLinks,
        ...legacyLinkFields,
        images: normalizedImages.length
          ? {
              createMany: {
                data: toImageCreateManyData(normalizedImages),
              },
            }
          : undefined,
        placements: {
          createMany: {
            data: placements,
          },
        },
      },
    })

    const normalizedRoles = await normalizeLinkedRoleInput(roles)

    await prisma.songMeta.create({
      data: {
        songId: song.id,
        aboutText: aboutText ?? '',
        roles: normalizedRoles,
        tags: Array.isArray(tags) ? tags : [],
        bpm: bpm ?? '',
        key: key ?? '',
        releaseDate: releaseDate ? new Date(releaseDate) : null,
      },
    })

    return res.status(201).json(await loadSong(session, song.id))
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
