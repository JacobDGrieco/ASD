import { prisma } from '../../../src/lib/prisma.js'
import { requireAdmin } from '../../../src/lib/auth.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  const { songId } = req.query
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
    await prisma.lyricBlock.deleteMany({ where: { songId } })
    await prisma.lyricBlock.createMany({
      data: blocks.map((b) => ({ songId, text: b.text, blockOrder: b.blockOrder })),
    })
    const updated = await prisma.lyricBlock.findMany({
      where: { songId },
      orderBy: { blockOrder: 'asc' },
      include: { annotations: true },
    })
    return res.status(200).json(updated)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
