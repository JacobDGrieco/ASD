import { prisma } from '../src/lib/prisma.js'
import { clientImages, mergeLegacyImages } from '../src/lib/images.js'

function formatArtistImages(artist) {
  return clientImages(mergeLegacyImages(artist.images, artist.portrait, {
    fallbackUsage: 'portrait',
    altText: artist.name,
    idPrefix: artist.id,
  }))
}

function formatAlbumImages(album) {
  return clientImages(mergeLegacyImages(album.images, album.coverArt, {
    fallbackUsage: 'cover',
    altText: album.title,
    idPrefix: album.id ?? album.slug ?? album.title,
  }))
}

function normalizeSlug(value) {
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === 'string' && value ? value : null
}

function setPublicCache(res) {
  // Metadata changes are edited live in admin, so freshness matters more than edge caching.
  res.setHeader('Cache-Control', 'no-store')
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
          songs: {
            orderBy: [{ discNumber: 'asc' }, { trackNumber: 'asc' }],
            select: { id: true, title: true, slug: true, trackNumber: true, discNumber: true, duration: true },
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
          id: true, title: true, slug: true, trackNumber: true, discNumber: true, duration: true,
          album: {
            select: {
              id: true, title: true, slug: true, coverArt: true, releaseDate: true, type: true,
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
  })

  const albumMap = new Map()
  for (const { featuredArtists, song } of featuredMetas) {
    const names = featuredArtists.split(';').map((n) => n.trim().toLowerCase())
    if (!names.includes(artist.name.toLowerCase())) continue
    const { album } = song
    if (!albumMap.has(album.id)) {
      const albumImages = formatAlbumImages(album)
      albumMap.set(album.id, { ...album, coverArt: albumImages[0]?.previewUrl ?? album.coverArt, songs: [] })
    }
    albumMap.get(album.id).songs.push({ id: song.id, title: song.title, slug: song.slug, trackNumber: song.trackNumber, discNumber: song.discNumber, duration: song.duration })
  }
  const featuredIn = Array.from(albumMap.values()).map((album) => ({
    ...album,
    songs: album.songs.sort((a, b) => a.discNumber - b.discNumber || a.trackNumber - b.trackNumber),
  }))

  return res.status(200).json({
    ...artist,
    portrait: images[0]?.previewUrl ?? artist.portrait,
    images,
    albums: artist.albums.map((album) => {
      const albumImages = formatAlbumImages(album)
      return {
        ...album,
        coverArt: albumImages[0]?.previewUrl ?? album.coverArt,
        images: albumImages,
      }
    }),
    featuredIn,
  })
}

async function getSong(res, slug) {
  setPublicCache(res)
  const song = await prisma.song.findUnique({
    where: { slug },
    include: {
      album: {
        select: {
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
      meta: true,
      lyricBlocks: {
        orderBy: { blockOrder: 'asc' },
        include: { annotations: { orderBy: { startChar: 'asc' } } },
      },
    },
  })

  if (!song) return res.status(404).json({ error: 'Song not found' })

  if (song.meta && !song.meta.releaseDate && song.album?.releaseDate) {
    song.meta = { ...song.meta, releaseDate: song.album.releaseDate }
  }

  if (song.meta?.featuredArtists) {
    const names = song.meta.featuredArtists.split(';').map((n) => n.trim()).filter(Boolean)
    const matched = await prisma.artist.findMany({
      where: { name: { in: names } },
      select: { name: true, slug: true },
    })
    const slugByName = Object.fromEntries(matched.map((a) => [a.name, a.slug]))
    song.meta = {
      ...song.meta,
      featuredArtistLinks: names.map((name) => ({ name, slug: slugByName[name] ?? null })),
    }
  }

  if (song.album) {
    const albumImages = formatAlbumImages(song.album)
    song.album.coverArt = albumImages[0]?.previewUrl ?? song.album.coverArt
  }

  return res.status(200).json(song)
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
    })

    return res.status(200).json(
      tracks.map((track) => {
        const albumImages = formatAlbumImages(track.song.album)
        return {
          ...track,
          song: {
            ...track.song,
            album: {
              ...track.song.album,
              coverArt: albumImages[0]?.previewUrl ?? track.song.album.coverArt,
            },
          },
        }
      })
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

  if (resource === 'artists') return getArtists(res)
  if (resource === 'artist' && slug) return getArtist(res, slug)
  if (resource === 'song' && slug) return getSong(res, slug)
  if (resource === 'recordPlayer') return getRecordPlayer(res)

  return res.status(404).json({ error: 'Not found' })
}
