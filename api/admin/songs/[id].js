import { prisma } from '../../../src/lib/prisma.js'
import { requireAdmin } from '../../../src/lib/auth.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  const { id } = req.query
  if (req.method === 'PUT') {
    const { title, slug, trackNumber, discNumber, duration, soundcloudUrl, spotifyUrl, appleMusicUrl, albumId, aboutText, producers, writers, releaseDate } = req.body
    const song = await prisma.song.update({ where: { id }, data: { title, slug, trackNumber: Number(trackNumber), discNumber: Number(discNumber ?? 1), duration, soundcloudUrl, spotifyUrl, appleMusicUrl, albumId } })
    await prisma.songMeta.upsert({
      where: { songId: id },
      create: { songId: id, aboutText: aboutText ?? '', producers: producers ?? '', writers: writers ?? '', releaseDate: releaseDate ? new Date(releaseDate) : null },
      update: { aboutText, producers, writers, releaseDate: releaseDate ? new Date(releaseDate) : null },
    })
    return res.status(200).json(song)
  }
  if (req.method === 'DELETE') {
    await prisma.song.delete({ where: { id } })
    return res.status(204).end()
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
