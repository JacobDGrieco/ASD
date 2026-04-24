import { prisma } from '../../../src/lib/prisma.js'
import { requireAdmin } from '../../../src/lib/auth.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  const { id } = req.query
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
