import { prisma } from '../../src/lib/prisma.js'
import { requireAdmin } from '../../src/lib/auth.js'
import { clientImages, mergeLegacyImages } from '../../src/lib/images.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return

  if (req.method === 'GET') {
    const tracks = await prisma.recordPlayerTrack.findMany({
      orderBy: { position: 'asc' },
      include: {
        song: {
          select: {
            id: true,
            title: true,
            slug: true,
            soundcloudUrl: true,
            placements: {
              orderBy: [{ placementOrder: 'asc' }],
              take: 1,
              select: {
                album: {
                  select: {
                    coverArt: true,
                    title: true,
                    images: {
                      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                      select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
    return res.status(200).json(
      tracks.map((track) => ({
        ...track,
        song: {
          ...track.song,
          album: track.song.placements[0]?.album
            ? {
                ...track.song.placements[0].album,
                coverArt: (clientImages(mergeLegacyImages(track.song.placements[0].album.images, track.song.placements[0].album.coverArt, {
                  fallbackUsage: 'cover',
                  altText: track.song.placements[0].album.title,
                  idPrefix: track.song.placements[0].album.title,
                }))[0]?.previewUrl) ?? track.song.placements[0].album.coverArt,
              }
            : null,
        },
      }))
    )
  }
  if (req.method === 'PUT') {
    const { tracks } = req.body
    await prisma.recordPlayerTrack.deleteMany()
    await prisma.recordPlayerTrack.createMany({
      data: tracks.map((t) => ({ songId: t.songId, position: Number(t.position), active: t.active ?? true })),
    })
    const updated = await prisma.recordPlayerTrack.findMany({
      orderBy: { position: 'asc' },
      include: { song: { select: { id: true, title: true, slug: true, soundcloudUrl: true } } },
    })
    return res.status(200).json(updated)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
