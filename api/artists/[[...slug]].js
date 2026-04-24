import { prisma } from '../../src/lib/prisma.js'
import { clientImages, mergeLegacyImages } from '../../src/lib/images.js'

function formatArtistImages(artist) {
  return clientImages(mergeLegacyImages(artist.images, artist.portrait, {
    fallbackUsage: 'portrait',
    altText: artist.name,
    idPrefix: artist.id,
  }))
}

function formatArtistListItem(artist) {
  const images = formatArtistImages(artist)

  return {
    ...artist,
    portrait: images[0]?.previewUrl ?? artist.portrait,
    images,
  }
}

function normalizeSlugParam(value) {
  if (Array.isArray(value)) return value[0]
  return typeof value === 'string' ? value : null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const slug = normalizeSlugParam(req.query.slug)

  if (!slug) {
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

    return res.status(200).json(artists.map(formatArtistListItem))
  }

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

  return res.status(200).json({
    ...artist,
    portrait: formatArtistImages(artist)[0]?.previewUrl ?? artist.portrait,
    images: formatArtistImages(artist),
    albums: artist.albums.map((album) => ({
      ...album,
      coverArt: (clientImages(mergeLegacyImages(album.images, album.coverArt, {
        fallbackUsage: 'cover',
        altText: album.title,
        idPrefix: album.id,
      }))[0]?.previewUrl) ?? album.coverArt,
      images: clientImages(mergeLegacyImages(album.images, album.coverArt, {
        fallbackUsage: 'cover',
        altText: album.title,
        idPrefix: album.id,
      })),
    })),
  })
}
