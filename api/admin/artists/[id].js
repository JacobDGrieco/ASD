import { prisma } from '../../../src/lib/prisma.js'
import { requireAdmin } from '../../../src/lib/auth.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  const { id } = req.query
  if (req.method === 'PUT') {
    const { name, slug, bio, aboutMe, portrait, order, soundcloudProfile, spotifyProfile, appleMusicProfile } = req.body
    const artist = await prisma.artist.update({ where: { id }, data: { name, slug, bio, aboutMe, portrait, order, soundcloudProfile, spotifyProfile, appleMusicProfile } })
    return res.status(200).json(artist)
  }
  if (req.method === 'DELETE') {
    await prisma.artist.delete({ where: { id } })
    return res.status(204).end()
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
