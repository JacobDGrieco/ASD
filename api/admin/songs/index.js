import { prisma } from '../../../src/lib/prisma.js'
import { requireAdmin } from '../../../src/lib/auth.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  if (req.method === 'GET') {
    const songs = await prisma.song.findMany({
      orderBy: [{ album: { releaseDate: 'desc' } }, { discNumber: 'asc' }, { trackNumber: 'asc' }],
      include: { album: { select: { title: true, artist: { select: { name: true } } } }, meta: true },
    })
    return res.status(200).json(songs)
  }
  if (req.method === 'POST') {
    const { title, slug, trackNumber, discNumber, duration, soundcloudUrl, spotifyUrl, appleMusicUrl, albumId } = req.body
    const song = await prisma.song.create({
      data: { title, slug, trackNumber: Number(trackNumber), discNumber: Number(discNumber ?? 1), duration: duration ?? '', soundcloudUrl, spotifyUrl, appleMusicUrl, albumId },
    })
    await prisma.songMeta.create({ data: { songId: song.id, aboutText: '', producers: '', writers: '' } })
    return res.status(201).json(song)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
