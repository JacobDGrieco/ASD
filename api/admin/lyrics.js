/**
 * Admin read/write for a song's lyric text (`SongLyric.text` — the annotations
 * themselves are managed separately by `annotations.js`). GET returns an empty
 * placeholder rather than 404 if no lyric row exists yet, so the editor can start
 * from a blank state for a song that's never had lyrics entered. Requires
 * `MUSIC_SONGS` page access; write additionally requires a non-viewer role, and the
 * song lookup is scoped through `artistScopedSongWhere` so an ARTIST session can't
 * touch another artist's lyrics.
 *
 * Server-only (Vercel Function). Consumed by `AdminMusicLyricsPage.jsx`.
 */
import { prisma } from '../../src/lib/prisma.js'
import { artistScopedSongWhere, canAccessAdminPage, isViewer, requireAdmin } from '../../src/lib/auth.js'
import { ADMIN_PAGE_KEYS } from '../../src/lib/adminPageAccess.js'

async function loadSongForLyrics(session, songId) {
  return prisma.song.findFirst({
    where: {
      id: songId,
      ...artistScopedSongWhere(session),
    },
    select: { id: true },
  })
}

export default async function handler(req, res) {
  const session = requireAdmin(req, res)
  if (!session) return
  if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.MUSIC_SONGS)) return res.status(403).json({ error: 'Forbidden' })

  const { songId } = req.query

  if (!songId) return res.status(400).json({ error: 'songId required' })

  const song = await loadSongForLyrics(session, songId)
  if (!song) return res.status(404).json({ error: 'Song not found' })

  if (req.method === 'GET') {
    const lyric = await prisma.songLyric.findUnique({
      where: { songId },
      include: {
        annotations: {
          orderBy: { createdAt: 'asc' },
          include: { ranges: { orderBy: { startChar: 'asc' } } },
        },
      },
    })

    if (!lyric) {
      return res.status(200).json({ id: null, songId, text: '', annotations: [] })
    }

    return res.status(200).json(lyric)
  }

  if (req.method === 'PUT') {
    if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })

    const { text } = req.body

    const upserted = await prisma.songLyric.upsert({
      where: { songId },
      create: { songId, text },
      update: { text },
    })

    return res.status(200).json(upserted)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
