import { prisma } from '../../src/lib/prisma.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const tracks = await prisma.recordPlayerTrack.findMany({
    where: { active: true },
    orderBy: { position: 'asc' },
    include: {
      song: {
        select: {
          id: true, title: true, slug: true, soundcloudUrl: true,
          album: { select: { coverArt: true, title: true, artist: { select: { name: true } } } },
        },
      },
    },
  })
  return res.status(200).json(tracks)
}
