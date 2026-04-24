import { prisma } from '../../src/lib/prisma.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { slug } = req.query
  const artist = await prisma.artist.findUnique({
    where: { slug },
    include: {
      albums: {
        orderBy: { releaseDate: 'desc' },
        include: {
          songs: {
            orderBy: [{ discNumber: 'asc' }, { trackNumber: 'asc' }],
            select: { id: true, title: true, slug: true, trackNumber: true, discNumber: true, duration: true },
          },
        },
      },
    },
  })
  if (!artist) return res.status(404).json({ error: 'Artist not found' })
  return res.status(200).json(artist)
}
