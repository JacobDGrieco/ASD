import { prisma } from '../../src/lib/prisma.js'
import { clientImages, mergeLegacyImages } from '../../src/lib/images.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { slug } = req.query
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
    portrait: (clientImages(mergeLegacyImages(artist.images, artist.portrait, {
      fallbackUsage: 'portrait',
      altText: artist.name,
      idPrefix: artist.id,
    }))[0]?.previewUrl) ?? artist.portrait,
    images: clientImages(mergeLegacyImages(artist.images, artist.portrait, {
      fallbackUsage: 'portrait',
      altText: artist.name,
      idPrefix: artist.id,
    })),
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
