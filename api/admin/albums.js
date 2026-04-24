import { prisma } from '../../src/lib/prisma.js'
import { requireAdmin } from '../../src/lib/auth.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  const { id } = req.query

  if (id) {
    if (req.method === 'PUT') {
      const { title, slug, type, coverArt, releaseDate, artistId } = req.body
      const album = await prisma.album.update({ where: { id }, data: { title, slug, type, coverArt, releaseDate: new Date(releaseDate), artistId } })
      return res.status(200).json(album)
    }
    if (req.method === 'DELETE') {
      await prisma.album.delete({ where: { id } })
      return res.status(204).end()
    }
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const albums = await prisma.album.findMany({
      orderBy: { releaseDate: 'desc' },
      include: { artist: { select: { name: true, slug: true } } },
    })
    return res.status(200).json(albums)
  }
  if (req.method === 'POST') {
    const { title, slug, type, coverArt, releaseDate, artistId } = req.body
    const album = await prisma.album.create({ data: { title, slug, type, coverArt: coverArt ?? '', releaseDate: new Date(releaseDate), artistId } })
    return res.status(201).json(album)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
