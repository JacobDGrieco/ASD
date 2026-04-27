import { prisma } from '../../src/lib/prisma.js'
import { artistScopedSongWhere, requireAdmin } from '../../src/lib/auth.js'

async function loadAnnotationForSession(session, id) {
  return prisma.annotation.findFirst({
    where: {
      id,
      lyricBlock: {
        song: artistScopedSongWhere(session),
      },
    },
    select: { id: true },
  })
}

async function loadLyricBlockForSession(session, lyricBlockId) {
  return prisma.lyricBlock.findFirst({
    where: {
      id: lyricBlockId,
      song: artistScopedSongWhere(session),
    },
    select: { id: true },
  })
}

export default async function handler(req, res) {
  const session = requireAdmin(req, res)
  if (!session) return

  const { id } = req.query

  if (id) {
    const annotation = await loadAnnotationForSession(session, id)
    if (!annotation) return res.status(404).json({ error: 'Annotation not found' })

    if (req.method === 'PUT') {
      const { startChar, endChar, explanation } = req.body
      const updated = await prisma.annotation.update({ where: { id }, data: { startChar: Number(startChar), endChar: Number(endChar), explanation } })
      return res.status(200).json(updated)
    }
    if (req.method === 'DELETE') {
      await prisma.annotation.delete({ where: { id } })
      return res.status(204).end()
    }
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'POST') {
    const { lyricBlockId, startChar, endChar, explanation } = req.body
    const lyricBlock = await loadLyricBlockForSession(session, lyricBlockId)
    if (!lyricBlock) return res.status(404).json({ error: 'Lyric block not found' })

    const annotation = await prisma.annotation.create({
      data: { lyricBlockId, startChar: Number(startChar), endChar: Number(endChar), explanation },
    })
    return res.status(201).json(annotation)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
