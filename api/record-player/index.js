import { prisma } from '../../src/lib/prisma.js'
import { clientImages, mergeLegacyImages } from '../../src/lib/images.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const tracks = await prisma.recordPlayerTrack.findMany({
    where: { active: true },
    orderBy: { position: 'asc' },
    include: {
      song: {
        select: {
          id: true, title: true, slug: true, soundcloudUrl: true,
          album: {
            select: {
              coverArt: true,
              title: true,
              images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true } },
              artist: { select: { name: true } },
            },
          },
        },
      },
    },
  })
  const formatted = tracks.map((track) => ({
    ...track,
    song: {
      ...track.song,
      album: {
        ...track.song.album,
        coverArt: (clientImages(mergeLegacyImages(track.song.album.images, track.song.album.coverArt, {
          fallbackUsage: 'cover',
          altText: track.song.album.title,
          idPrefix: track.song.album.title,
        }))[0]?.previewUrl) ?? track.song.album.coverArt,
      },
    },
  }))
  return res.status(200).json(formatted)
}
