import { prisma } from '../../../src/lib/prisma.js'
import { requireAdmin } from '../../../src/lib/auth.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  const { id } = req.query
  if (req.method === 'PUT') {
    const { startChar, endChar, explanation } = req.body
    const annotation = await prisma.annotation.update({ where: { id }, data: { startChar: Number(startChar), endChar: Number(endChar), explanation } })
    return res.status(200).json(annotation)
  }
  if (req.method === 'DELETE') {
    await prisma.annotation.delete({ where: { id } })
    return res.status(204).end()
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
