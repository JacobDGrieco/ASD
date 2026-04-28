import { prisma } from '../../src/lib/prisma.js'
import { artistScopedSongWhere, isSuperAdmin, requireAdmin } from '../../src/lib/auth.js'
import { slugify } from '../../src/lib/slugify.js'
import {
  clientImages,
  mergeLegacyImages,
  normalizeImageInput,
  primaryImageReference,
  toImageCreateManyData,
} from '../../src/lib/images.js'

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

function formatSong(song) {
  const placements = [...(song.placements ?? [])].sort((left, right) => left.placementOrder - right.placementOrder)
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
            artist: { select: { id: true, name: true, slug: true, order: true } },
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
            artist: { select: { id: true, name: true, slug: true, order: true } },
          },
        },
      },
    },
    meta: {
      select: {
        featuredArtists: true,
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

  const { id } = req.query

  if (id) {
    const existingSong = await loadSong(session, id)
    if (!existingSong) return res.status(404).json({ error: 'Song not found' })

    if (req.method === 'GET') {
      return res.status(200).json(existingSong)
    }

    if (req.method === 'PUT') {
      const {
        title,
        slug,
        duration,
        soundcloudUrl,
        spotifyUrl,
        appleMusicUrl,
        youtubeUrl,
        aboutText,
        producers,
        writers,
        featuredArtists,
        releaseDate,
        images,
        tags,
      } = req.body
      const placements = normalizePlacements(req.body)
      const validationError = validatePlacements(placements)
      if (validationError) return res.status(400).json({ error: validationError })
      if (!(await validatePlacementOwnership(session, placements))) {
        return res.status(403).json({ error: 'You can only assign songs to your own albums.' })
      }

      const normalizedImages = normalizeImageInput(images, 'artwork')

      await prisma.song.update({
        where: { id },
        data: {
          title,
          slug: slug || slugify(title),
          duration,
          artwork: primaryImageReference(normalizedImages),
          soundcloudUrl,
          spotifyUrl,
          appleMusicUrl,
          youtubeUrl,
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

      await prisma.songMeta.upsert({
        where: { songId: id },
        create: {
          songId: id,
          aboutText: aboutText ?? '',
          producers: producers ?? '',
          writers: writers ?? '',
          featuredArtists: featuredArtists ?? '',
          tags: Array.isArray(tags) ? tags : [],
          releaseDate: releaseDate ? new Date(releaseDate) : null,
        },
        update: {
          aboutText,
          producers,
          writers,
          featuredArtists,
          tags: Array.isArray(tags) ? tags : [],
          releaseDate: releaseDate ? new Date(releaseDate) : null,
        },
      })

      return res.status(200).json(await loadSong(session, id))
    }

    if (req.method === 'DELETE') {
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
      .map(formatSong)
      .map(withListImages)
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
    const {
      title,
      slug,
      duration,
      soundcloudUrl,
      spotifyUrl,
      appleMusicUrl,
      youtubeUrl,
      aboutText,
      producers,
      writers,
      featuredArtists,
      releaseDate,
      images,
      tags,
    } = req.body
    const placements = normalizePlacements(req.body)
    const validationError = validatePlacements(placements)
    if (validationError) return res.status(400).json({ error: validationError })
    if (!(await validatePlacementOwnership(session, placements))) {
      return res.status(403).json({ error: 'You can only assign songs to your own albums.' })
    }

    const normalizedImages = normalizeImageInput(images, 'artwork')
    const song = await prisma.song.create({
      data: {
        title,
        slug: slug || slugify(title),
        duration: duration ?? '',
        artwork: primaryImageReference(normalizedImages),
        soundcloudUrl,
        spotifyUrl,
        appleMusicUrl,
        youtubeUrl,
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

    await prisma.songMeta.create({
      data: {
        songId: song.id,
        aboutText: aboutText ?? '',
        producers: producers ?? '',
        writers: writers ?? '',
        featuredArtists: featuredArtists ?? '',
        tags: Array.isArray(tags) ? tags : [],
        releaseDate: releaseDate ? new Date(releaseDate) : null,
      },
    })

    return res.status(201).json(await loadSong(session, song.id))
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
