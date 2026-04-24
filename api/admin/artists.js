import { prisma } from '../../src/lib/prisma.js'
import { requireAdmin } from '../../src/lib/auth.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  const { id } = req.query

  if (id) {
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

  if (req.method === 'GET') {
    const artists = await prisma.artist.findMany({ orderBy: { order: 'asc' } })
    return res.status(200).json(artists)
  }
  if (req.method === 'POST') {
    const { name, slug, bio, aboutMe, portrait, order, soundcloudProfile, spotifyProfile, appleMusicProfile } = req.body
    const artist = await prisma.artist.create({
      data: { name, slug, bio: bio ?? '', aboutMe: aboutMe ?? '', portrait: portrait ?? '', order: order ?? 0, soundcloudProfile, spotifyProfile, appleMusicProfile },
    })
    return res.status(201).json(artist)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
