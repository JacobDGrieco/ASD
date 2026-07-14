import { prisma } from '../../src/lib/prisma.js'
import { isViewer, requireAdmin } from '../../src/lib/auth.js'
import { clientImages, normalizeImageInput, primaryImageReference } from '../../src/lib/images.js'

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeExternalUrl(value) {
  const url = normalizeString(value)
  if (!url) return ''

  try {
    const parsed = new URL(url.includes('://') ? url : `https://${url}`)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : ''
  } catch {
    return ''
  }
}

function selectOutsideArtist() {
  return {
    id: true,
    name: true,
    role: true,
    externalUrl: true,
    imageUrl: true,
    pathname: true,
    createdAt: true,
    updatedAt: true,
  }
}

function withOutsideArtistImage(outsideArtist) {
  const image = outsideArtist.imageUrl
    ? clientImages([{
        id: `${outsideArtist.id}-img`,
        url: outsideArtist.imageUrl,
        pathname: outsideArtist.pathname,
        usage: 'portrait',
        altText: outsideArtist.name,
        sortOrder: 0,
        isPrimary: true,
      }])[0]
    : null

  return { ...outsideArtist, image }
}

function validateOutsideArtist(body) {
  const name = normalizeString(body?.name)
  if (!name) return { error: 'Name is required.' }
  const normalizedImage = normalizeImageInput(body?.image ? [body.image] : [], 'portrait')

  return {
    name,
    role: normalizeString(body?.role),
    externalUrl: normalizeExternalUrl(body?.externalUrl),
    imageUrl: primaryImageReference(normalizedImage),
    pathname: normalizedImage[0]?.pathname ?? null,
  }
}

export default async function handler(req, res) {
  const session = requireAdmin(req, res)
  if (!session) return

  const id = typeof req.query.id === 'string' ? req.query.id : ''

  if (id) {
    const existing = await prisma.musicOutsideArtist.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return res.status(404).json({ error: 'Outside artist not found.' })

    if (req.method === 'GET') {
      const outsideArtist = await prisma.musicOutsideArtist.findUnique({
        where: { id },
        select: selectOutsideArtist(),
      })
      return res.status(200).json(withOutsideArtistImage(outsideArtist))
    }

    if (req.method === 'PUT') {
      if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
      const validation = validateOutsideArtist(req.body ?? {})
      if (validation.error) return res.status(400).json({ error: validation.error })

      const outsideArtist = await prisma.musicOutsideArtist.update({
        where: { id },
        data: validation,
        select: selectOutsideArtist(),
      })
      return res.status(200).json(withOutsideArtistImage(outsideArtist))
    }

    if (req.method === 'DELETE') {
      if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
      await prisma.musicOutsideArtist.delete({ where: { id } })
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const outsideArtists = await prisma.musicOutsideArtist.findMany({
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      select: selectOutsideArtist(),
    })
    return res.status(200).json(outsideArtists.map(withOutsideArtistImage))
  }

  if (req.method === 'POST') {
    if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
    const validation = validateOutsideArtist(req.body ?? {})
    if (validation.error) return res.status(400).json({ error: validation.error })

    const outsideArtist = await prisma.musicOutsideArtist.create({
      data: validation,
      select: selectOutsideArtist(),
    })
    return res.status(201).json(withOutsideArtistImage(outsideArtist))
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
