import { prisma } from './prisma.js'
import { isArtistAdmin, isSuperAdmin, isViewer } from './auth.js'
import { ASD_RECORDS_ARTIST_NAME, ASD_RECORDS_ARTIST_OPTION_ID, ASD_RECORDS_ARTIST_SLUG } from './publicVisibility.js'

const BOARD_COUNT_CAP = 25
const BOARD_AGE_DAYS = 90
const MAX_BODY_IMAGES = 1
const MAX_BODY_LINKS = 3

function now() {
  return new Date()
}

function ageCapDate() {
  const d = new Date()
  d.setDate(d.getDate() - BOARD_AGE_DAYS)
  return d
}

function publicWhere() {
  return {
    publishedAt: { not: null, lte: now() },
    archivedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }],
    AND: [{ publishedAt: { gte: ageCapDate() } }],
  }
}

function artistScopedWhere(session) {
  if (isSuperAdmin(session)) return {}
  if (isArtistAdmin(session)) return { artistId: session.artistId }
  return { artistId: '__none__' }
}

function includeArtist() {
  return { select: { id: true, name: true, slug: true } }
}

function countHtmlOccurrences(html, pattern) {
  return (String(html ?? '').match(pattern) ?? []).length
}

function validateBoardBody(body) {
  const bodyHtml = String(body ?? '')
  const imageCount = countHtmlOccurrences(bodyHtml, /<img\b/gi)
  const linkCount = countHtmlOccurrences(bodyHtml, /<a\b[^>]*href\s*=/gi)

  if (imageCount > MAX_BODY_IMAGES) {
    return `Board posts can include at most ${MAX_BODY_IMAGES} image in the body.`
  }

  if (linkCount > MAX_BODY_LINKS) {
    return `Board posts can include at most ${MAX_BODY_LINKS} links in the body.`
  }

  return null
}

async function resolveBoardArtistId(session, artistId) {
  if (!isSuperAdmin(session)) return session.artistId
  if (!artistId) return null
  if (artistId !== ASD_RECORDS_ARTIST_OPTION_ID) return artistId

  const labelArtist = await prisma.artist.upsert({
    where: { slug: ASD_RECORDS_ARTIST_SLUG },
    update: { name: ASD_RECORDS_ARTIST_NAME },
    create: {
      name: ASD_RECORDS_ARTIST_NAME,
      slug: ASD_RECORDS_ARTIST_SLUG,
      bio: '',
      aboutMe: '',
      portrait: '',
      order: 999998,
    },
    select: { id: true },
  })

  return labelArtist.id
}

async function autoArchiveOldest() {
  const count = await prisma.boardPost.count({ where: publicWhere() })
  if (count <= BOARD_COUNT_CAP) return

  const oldest = await prisma.boardPost.findFirst({
    where: publicWhere(),
    orderBy: { publishedAt: 'asc' },
    select: { id: true },
  })
  if (!oldest) return

  await prisma.boardPost.update({
    where: { id: oldest.id },
    data: { archivedAt: now() },
  })
}

export async function handleAdminBoard(req, res, session) {
  const { id, action } = req.query

  if (id) {
    const post = await prisma.boardPost.findFirst({
      where: { id, ...artistScopedWhere(session) },
      include: { artist: includeArtist() },
    })
    if (!post) return res.status(404).json({ error: 'Post not found' })

    if (req.method === 'PUT') {
      if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
      if (isArtistAdmin(session) && post.artistId !== session.artistId) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const { title, headline, body, imageUrl, pinColor, expiresAt, publishedAt, artistId } = req.body
      if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' })
      if (!headline?.trim()) return res.status(400).json({ error: 'Headline is required.' })
      const bodyError = validateBoardBody(body)
      if (bodyError) return res.status(400).json({ error: bodyError })
      const resolvedArtistId = await resolveBoardArtistId(session, artistId ?? post.artistId)
      if (!resolvedArtistId) return res.status(400).json({ error: 'Artist is required.' })

      const updated = await prisma.boardPost.update({
        where: { id },
        data: {
          artistId: resolvedArtistId,
          title: title.trim(),
          headline: headline.trim(),
          body: body ?? '',
          imageUrl: imageUrl || null,
          pinColor: pinColor || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          publishedAt: publishedAt ? new Date(publishedAt) : null,
        },
        include: { artist: includeArtist() },
      })

      if (updated.publishedAt) await autoArchiveOldest()
      return res.status(200).json(updated)
    }

    if (req.method === 'DELETE') {
      if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
      if (isArtistAdmin(session) && post.artistId !== session.artistId) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      await prisma.boardPost.delete({ where: { id } })
      return res.status(204).end()
    }

    if (req.method === 'PATCH') {
      if (!isSuperAdmin(session)) return res.status(403).json({ error: 'Forbidden' })

      if (action === 'position') {
        const { posX, posY, rotation, positionPinnedUntil } = req.body
        const updated = await prisma.boardPost.update({
          where: { id },
          data: {
            posX: posX != null ? Number(posX) : null,
            posY: posY != null ? Number(posY) : null,
            rotation: rotation != null ? Number(rotation) : null,
            positionPinnedUntil: positionPinnedUntil ? new Date(positionPinnedUntil) : null,
          },
          include: { artist: includeArtist() },
        })
        return res.status(200).json(updated)
      }

      if (action === 'archive') {
        const { archive } = req.body
        const updated = await prisma.boardPost.update({
          where: { id },
          data: { archivedAt: archive ? now() : null },
          include: { artist: includeArtist() },
        })
        return res.status(200).json(updated)
      }

      return res.status(400).json({ error: 'Unknown action' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const posts = await prisma.boardPost.findMany({
      where: artistScopedWhere(session),
      orderBy: { createdAt: 'desc' },
      include: { artist: includeArtist() },
    })
    return res.status(200).json(posts)
  }

  if (req.method === 'POST') {
    if (!isArtistAdmin(session) && !isSuperAdmin(session)) {
      return res.status(403).json({ error: 'Only artist or super admin accounts can create posts.' })
    }
    const { title, headline, body, imageUrl, pinColor, expiresAt, publishedAt, artistId } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' })
    if (!headline?.trim()) return res.status(400).json({ error: 'Headline is required.' })
    const bodyError = validateBoardBody(body)
    if (bodyError) return res.status(400).json({ error: bodyError })
    const resolvedArtistId = await resolveBoardArtistId(session, artistId)
    if (!resolvedArtistId) return res.status(400).json({ error: 'Artist is required.' })

    const post = await prisma.boardPost.create({
      data: {
        artistId: resolvedArtistId,
        title: title.trim(),
        headline: headline.trim(),
        body: body ?? '',
        imageUrl: imageUrl || null,
        pinColor: pinColor || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
      },
      include: { artist: includeArtist() },
    })

    if (post.publishedAt) await autoArchiveOldest()
    return res.status(201).json(post)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
