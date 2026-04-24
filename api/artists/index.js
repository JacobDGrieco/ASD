import { prisma } from '../../src/lib/prisma.js'
import { clientImages, mergeLegacyImages } from '../../src/lib/images.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

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
    artists.map((artist) => ({
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
    }))
  )
}
