import { prisma } from '../../../src/lib/prisma.js'
import { requireAdmin } from '../../../src/lib/auth.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  if (req.method === 'GET') {
    const tracks = await prisma.recordPlayerTrack.findMany({
      orderBy: { position: 'asc' },
      include: { song: { select: { id: true, title: true, slug: true, soundcloudUrl: true, album: { select: { coverArt: true, title: true } } } } },
    })
    return res.status(200).json(tracks)
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
