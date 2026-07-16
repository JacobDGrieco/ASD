/**
 * Admin CRUD for lyric annotations (the clickable explanation popups on song
 * lyrics). Requires `MUSIC_SONGS` page access and a non-viewer role; every
 * annotation/lyric lookup is scoped through `artistScopedSongWhere` so an ARTIST
 * session can't read or edit annotations on another artist's songs.
 *
 * `PUT` replaces an annotation's character ranges wholesale inside a transaction
 * (delete-all-then-recreate) rather than diffing — simpler than reconciling range
 * edits, and ranges have no independent identity worth preserving across an edit.
 *
 * Server-only (Vercel Function). Consumed by `AdminMusicLyricsPage.jsx`.
 */
import { prisma } from '../../src/lib/prisma.js'
import { artistScopedSongWhere, canAccessAdminPage, isViewer, requireAdmin } from '../../src/lib/auth.js'
import { ADMIN_PAGE_KEYS } from '../../src/lib/adminPageAccess.js'

async function loadAnnotationForSession(session, id) {
  return prisma.songAnnotation.findFirst({
    where: {
      id,
      songLyric: {
        song: artistScopedSongWhere(session),
      },
    },
    select: { id: true },
  })
}

async function loadSongLyricForSession(session, songLyricId) {
  return prisma.songLyric.findFirst({
    where: {
      id: songLyricId,
      song: artistScopedSongWhere(session),
    },
    select: { id: true },
  })
}

export default async function handler(req, res) {
  const session = requireAdmin(req, res)
  if (!session) return
  if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.MUSIC_SONGS)) return res.status(403).json({ error: 'Forbidden' })
  if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })

  const { id } = req.query

  if (id) {
    const annotation = await loadAnnotationForSession(session, id)
    if (!annotation) return res.status(404).json({ error: 'Annotation not found' })

    if (req.method === 'PUT') {
      const { explanation, ranges } = req.body

      await prisma.$transaction([
        prisma.songAnnotationRange.deleteMany({ where: { songAnnotationId: id } }),
        prisma.songAnnotation.update({
          where: { id },
          data: {
            explanation,
            ranges: {
              create: ranges.map(r => ({ startChar: Number(r.startChar), endChar: Number(r.endChar) }))
            }
          }
        })
      ])

      const updated = await prisma.songAnnotation.findUnique({
        where: { id },
        include: { ranges: { orderBy: { startChar: 'asc' } } }
      })
      return res.status(200).json(updated)
    }
    if (req.method === 'DELETE') {
      await prisma.songAnnotation.delete({ where: { id } })
      return res.status(204).end()
    }
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'POST') {
    const { songLyricId, explanation, ranges } = req.body
    const songLyric = await loadSongLyricForSession(session, songLyricId)
    if (!songLyric) return res.status(404).json({ error: 'Song lyric not found' })

    const annotation = await prisma.songAnnotation.create({
      data: {
        songLyricId,
        explanation,
        ranges: {
          create: ranges.map(r => ({ startChar: Number(r.startChar), endChar: Number(r.endChar) }))
        }
      },
      include: { ranges: { orderBy: { startChar: 'asc' } } }
    })
    return res.status(201).json(annotation)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
