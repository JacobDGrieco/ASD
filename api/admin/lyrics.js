import { prisma } from '../../src/lib/prisma.js'
import { artistScopedSongWhere, isViewer, requireAdmin } from '../../src/lib/auth.js'

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

  const { songId } = req.query

  if (!songId) return res.status(400).json({ error: 'songId required' })

  const song = await loadSongForLyrics(session, songId)
  if (!song) return res.status(404).json({ error: 'Song not found' })

  if (req.method === 'GET') {
    const blocks = await prisma.lyricBlock.findMany({
      where: { songId },
      orderBy: { blockOrder: 'asc' },
      include: { annotations: { orderBy: { startChar: 'asc' } } },
    })
    return res.status(200).json(blocks)
  }
  if (req.method === 'PUT') {
    if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
    const { blocks } = req.body
    const existingBlocks = await prisma.lyricBlock.findMany({
      where: { songId },
      orderBy: { blockOrder: 'asc' },
    })
    const existingIds = new Set(existingBlocks.map((block) => block.id))
    const incomingIds = new Set(blocks.filter((block) => block.id).map((block) => block.id))
    const deletedIds = existingBlocks.filter((block) => !incomingIds.has(block.id)).map((block) => block.id)

    if (deletedIds.length) {
      await prisma.lyricBlock.deleteMany({ where: { id: { in: deletedIds } } })
    }

    await Promise.all(
      blocks
        .filter((block) => block.id && existingIds.has(block.id))
        .map((block) => prisma.lyricBlock.update({
          where: { id: block.id },
          data: { text: block.text, blockOrder: block.blockOrder },
        }))
    )

    const createdBlocks = blocks
      .filter((block) => !block.id)
      .map((block) => ({ songId, text: block.text, blockOrder: block.blockOrder }))

    if (createdBlocks.length) {
      await prisma.lyricBlock.createMany({ data: createdBlocks })
    }

    const updated = await prisma.lyricBlock.findMany({
      where: { songId },
      orderBy: { blockOrder: 'asc' },
      include: { annotations: { orderBy: { startChar: 'asc' } } },
    })
    return res.status(200).json(updated)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
