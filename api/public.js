import { prisma } from '../src/lib/prisma.js'
import { clientImages, mergeLegacyImages } from '../src/lib/images.js'

function formatArtistImages(artist) {
  return clientImages(
    mergeLegacyImages(artist.images, artist.portrait, {
      fallbackUsage: 'portrait',
      altText: artist.name,
      idPrefix: artist.id,
    })
  )
}

function formatAlbumImages(album) {
  return clientImages(
    mergeLegacyImages(album.images, album.coverArt, {
      fallbackUsage: 'cover',
      altText: album.title,
      idPrefix: album.id ?? album.slug ?? album.title,
    })
  )
}

function formatSongImages(song) {
  return clientImages(
    mergeLegacyImages(song.images, song.artwork, {
      fallbackUsage: 'artwork',
      altText: song.title,
      idPrefix: song.id,
    })
  )
}

function normalizeSlug(value) {
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === 'string' && value ? value : null
}

function setPublicCache(res) {
  res.setHeader('Cache-Control', 'no-store')
}

function parseCreditNames(value) {
  if (typeof value !== 'string') return []
  return value
    .split(';')
    .map((name) => name.trim())
    .filter(Boolean)
}

async function resolveArtistLinksByName(names) {
  const uniqueNames = [...new Set((Array.isArray(names) ? names : []).map((name) => name.trim()).filter(Boolean))]
  if (!uniqueNames.length) return {}

  const matched = await prisma.artist.findMany({
    where: {
      OR: uniqueNames.map((name) => ({
        name: { equals: name, mode: 'insensitive' },
      })),
    },
    select: { name: true, slug: true },
  })

  return Object.fromEntries(
    matched.map((artist) => [artist.name.trim().toLowerCase(), artist.slug])
  )
}

function mapArtistLinks(names, slugByName) {
  return names.map((name) => ({
    name,
    slug: slugByName[name.trim().toLowerCase()] ?? null,
  }))
}

function formatAlbumSummary(album) {
  const albumImages = formatAlbumImages(album)
  return {
    ...album,
    coverArt: albumImages[0]?.previewUrl ?? album.coverArt,
    images: albumImages,
  }
}

function formatPlacementSongs(placements) {
  return placements
    .slice()
    .sort((left, right) => {
      if (left.discNumber !== right.discNumber) return left.discNumber - right.discNumber
      if (left.trackNumber !== right.trackNumber) return left.trackNumber - right.trackNumber
      return left.placementOrder - right.placementOrder
    })
    .map((placement) => ({
      id: placement.song.id,
      title: placement.song.title,
      slug: placement.song.slug,
      duration: placement.song.duration,
      trackNumber: placement.trackNumber,
      discNumber: placement.discNumber,
      placementOrder: placement.placementOrder,
    }))
}

function resolvePrimaryPlacement(placements, albumSlug = null) {
  if (!placements?.length) return null
  return placements.find((placement) => placement.album.slug === albumSlug) ?? placements[0]
}

async function getArtists(res) {
  setPublicCache(res)
  const artists = await prisma.artist.findMany({
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      bio: true,
      portrait: true,
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
      },
      order: true,
      soundcloudProfile: true,
      spotifyProfile: true,
      appleMusicProfile: true,
      youtubeProfile: true,
    },
  })

  return res.status(200).json(
    artists.map((artist) => {
      const images = formatArtistImages(artist)
      return {
        ...artist,
        portrait: images[0]?.previewUrl ?? artist.portrait,
        images,
      }
    })
  )
}

async function getArtist(res, slug) {
  setPublicCache(res)
  const artist = await prisma.artist.findUnique({
    where: { slug },
    include: {
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      albums: {
        orderBy: { releaseDate: 'desc' },
        include: {
          images: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
          songPlacements: {
            include: {
              song: {
                select: { id: true, title: true, slug: true, duration: true },
              },
            },
            orderBy: [{ discNumber: 'asc' }, { trackNumber: 'asc' }, { placementOrder: 'asc' }],
          },
        },
      },
    },
  })

  if (!artist) return res.status(404).json({ error: 'Artist not found' })

  const images = formatArtistImages(artist)

  const featuredMetas = await prisma.songMeta.findMany({
    where: { featuredArtists: { contains: artist.name, mode: 'insensitive' } },
    select: {
      featuredArtists: true,
      song: {
        select: {
          id: true,
          title: true,
          slug: true,
          duration: true,
          placements: {
            orderBy: [{ placementOrder: 'asc' }],
            select: {
              trackNumber: true,
              discNumber: true,
              placementOrder: true,
              album: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  coverArt: true,
                  releaseDate: true,
                  type: true,
                  images: {
                    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                    select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
                  },
                  artist: { select: { name: true, slug: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  const albumMap = new Map()
  for (const { featuredArtists, song } of featuredMetas) {
    const names = featuredArtists.split(';').map((name) => name.trim().toLowerCase())
    if (!names.includes(artist.name.toLowerCase())) continue

    for (const placement of song.placements) {
      const album = placement.album
      if (!albumMap.has(album.id)) {
        albumMap.set(album.id, { ...formatAlbumSummary(album), songs: [] })
      }

      albumMap.get(album.id).songs.push({
        id: song.id,
        title: song.title,
        slug: song.slug,
        duration: song.duration,
        trackNumber: placement.trackNumber,
        discNumber: placement.discNumber,
        placementOrder: placement.placementOrder,
      })
    }
  }

  const featuredIn = Array.from(albumMap.values()).map((album) => ({
    ...album,
    songs: album.songs.sort((left, right) => {
      if (left.discNumber !== right.discNumber) return left.discNumber - right.discNumber
      if (left.trackNumber !== right.trackNumber) return left.trackNumber - right.trackNumber
      return left.placementOrder - right.placementOrder
    }),
  }))

  return res.status(200).json({
    ...artist,
    portrait: images[0]?.previewUrl ?? artist.portrait,
    images,
    albums: artist.albums.map((album) => ({
      ...formatAlbumSummary(album),
      songs: formatPlacementSongs(album.songPlacements),
    })),
    featuredIn,
  })
}

async function getAlbum(res, slug) {
  setPublicCache(res)
  const album = await prisma.album.findUnique({
    where: { slug },
    include: {
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      artist: { select: { name: true, slug: true } },
      songPlacements: {
        include: {
          song: {
            select: { id: true, title: true, slug: true, duration: true },
          },
        },
        orderBy: [{ discNumber: 'asc' }, { trackNumber: 'asc' }, { placementOrder: 'asc' }],
      },
    },
  })

  if (!album) return res.status(404).json({ error: 'Album not found' })

  const albumImages = formatAlbumImages(album)
  return res.status(200).json({
    ...album,
    coverArt: albumImages[0]?.previewUrl ?? album.coverArt,
    images: albumImages,
    songs: formatPlacementSongs(album.songPlacements),
  })
}

async function getSong(res, slug, albumSlug = null) {
  setPublicCache(res)
  const song = await prisma.song.findUnique({
    where: { slug },
    include: {
      placements: {
        orderBy: [{ placementOrder: 'asc' }],
        include: {
          album: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverArt: true,
              releaseDate: true,
              images: {
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
              },
              artist: { select: { name: true, slug: true } },
            },
          },
        },
      },
      meta: true,
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      lyricBlocks: {
        orderBy: { blockOrder: 'asc' },
        include: { annotations: { orderBy: { startChar: 'asc' } } },
      },
    },
  })

  if (!song) return res.status(404).json({ error: 'Song not found' })

  const primaryPlacement = resolvePrimaryPlacement(song.placements, albumSlug)
  const primaryAlbum = primaryPlacement?.album ?? null

  if (song.meta && !song.meta.releaseDate && primaryAlbum?.releaseDate) {
    song.meta = { ...song.meta, releaseDate: primaryAlbum.releaseDate }
  }

  if (song.meta) {
    const featuredArtistNames = parseCreditNames(song.meta.featuredArtists)
    const producerNames = parseCreditNames(song.meta.producers)
    const writerNames = parseCreditNames(song.meta.writers)
    const slugByName = await resolveArtistLinksByName([
      ...featuredArtistNames,
      ...producerNames,
      ...writerNames,
    ])

    song.meta = {
      ...song.meta,
      featuredArtistLinks: mapArtistLinks(featuredArtistNames, slugByName),
      producerLinks: mapArtistLinks(producerNames, slugByName),
      writerLinks: mapArtistLinks(writerNames, slugByName),
    }
  }

  const placements = song.placements.map((placement) => {
    const album = formatAlbumSummary(placement.album)
    return {
      albumId: album.id,
      trackNumber: placement.trackNumber,
      discNumber: placement.discNumber,
      placementOrder: placement.placementOrder,
      album,
    }
  })

  const songImages = formatSongImages(song)

  return res.status(200).json({
    ...song,
    album: placements.find((placement) => placement.album.slug === primaryAlbum?.slug)?.album ?? placements[0]?.album ?? null,
    albumId: primaryPlacement?.albumId ?? '',
    trackNumber: primaryPlacement?.trackNumber ?? null,
    discNumber: primaryPlacement?.discNumber ?? null,
    placements,
    albumIds: placements.map((placement) => placement.albumId),
    trackNumbers: placements.map((placement) => placement.trackNumber),
    discNumbers: placements.map((placement) => placement.discNumber),
    artwork: songImages[0]?.previewUrl ?? song.artwork,
    images: songImages,
  })
}

async function getRecordPlayer(res) {
  try {
    setPublicCache(res)
    const tracks = await prisma.recordPlayerTrack.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
      include: {
        song: {
          select: {
            id: true,
            title: true,
            slug: true,
            soundcloudUrl: true,
            youtubeUrl: true,
            placements: {
              orderBy: [{ placementOrder: 'asc' }],
              take: 1,
              include: {
                album: {
                  select: {
                    coverArt: true,
                    title: true,
                    images: {
                      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                      select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
                    },
                    artist: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    return res.status(200).json(
      tracks
        .map((track) => {
          const placement = track.song.placements[0]
          if (!placement) return null

          const album = formatAlbumSummary(placement.album)
          return {
            ...track,
            song: {
              ...track.song,
              album,
            },
          }
        })
        .filter(Boolean)
    )
  } catch (error) {
    console.error('Record player route failed', error)
    return res.status(200).json([])
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const resource = typeof req.query.resource === 'string' ? req.query.resource : ''
  const slug = normalizeSlug(req.query.slug)
  const albumSlug = typeof req.query.albumSlug === 'string' ? req.query.albumSlug : null

  if (resource === 'artists') return getArtists(res)
  if (resource === 'artist' && slug) return getArtist(res, slug)
  if (resource === 'album' && slug) return getAlbum(res, slug)
  if (resource === 'song' && slug) return getSong(res, slug, albumSlug)
  if (resource === 'recordPlayer') return getRecordPlayer(res)

  return res.status(404).json({ error: 'Not found' })
}
