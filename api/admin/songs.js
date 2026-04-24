import { prisma } from '../../src/lib/prisma.js'
import { requireAdmin } from '../../src/lib/auth.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  const { id } = req.query

  if (id) {
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

  if (req.method === 'GET') {
    const songs = await prisma.song.findMany({
      orderBy: [{ album: { releaseDate: 'desc' } }, { discNumber: 'asc' }, { trackNumber: 'asc' }],
      include: { album: { select: { title: true, releaseDate: true, artist: { select: { name: true } } } }, meta: true },
    })
    return res.status(200).json(songs)
  }
  if (req.method === 'POST') {
    const { title, slug, trackNumber, discNumber, duration, soundcloudUrl, spotifyUrl, appleMusicUrl, albumId, aboutText, producers, writers, releaseDate } = req.body
    const song = await prisma.song.create({
      data: { title, slug, trackNumber: Number(trackNumber), discNumber: Number(discNumber ?? 1), duration: duration ?? '', soundcloudUrl, spotifyUrl, appleMusicUrl, albumId },
    })
    await prisma.songMeta.create({
      data: {
        songId: song.id,
        aboutText: aboutText ?? '',
        producers: producers ?? '',
        writers: writers ?? '',
        releaseDate: releaseDate ? new Date(releaseDate) : null,
      },
    })
    return res.status(201).json(song)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
