import { prisma } from '../../src/lib/prisma.js'
import { requireAdmin } from '../../src/lib/auth.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  const { songId } = req.query

  if (!songId) return res.status(400).json({ error: 'songId required' })

  if (req.method === 'GET') {
    const blocks = await prisma.lyricBlock.findMany({
      where: { songId },
      orderBy: { blockOrder: 'asc' },
      include: { annotations: { orderBy: { startChar: 'asc' } } },
    })
    return res.status(200).json(blocks)
  }
  if (req.method === 'PUT') {
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
