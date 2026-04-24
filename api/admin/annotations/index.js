import { prisma } from '../../../src/lib/prisma.js'
import { requireAdmin } from '../../../src/lib/auth.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  if (req.method === 'POST') {
    const { lyricBlockId, startChar, endChar, explanation } = req.body
    const annotation = await prisma.annotation.create({
      data: { lyricBlockId, startChar: Number(startChar), endChar: Number(endChar), explanation },
    })
    return res.status(201).json(annotation)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
