import { prisma } from '../../src/lib/prisma.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { slug } = req.query
  const song = await prisma.song.findUnique({
    where: { slug },
    include: {
      album: {
        select: {
          title: true, slug: true, coverArt: true, releaseDate: true,
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
  return res.status(200).json(song)
}
