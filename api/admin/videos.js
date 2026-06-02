import { prisma } from '../../src/lib/prisma.js'
import { canAccessArtist, isSuperAdmin, isViewer, requireAdmin } from '../../src/lib/auth.js'
import { buildClientImageUrl } from '../../src/lib/images.js'
import { buildStaticArtistVideoPath, getStaticArtistVideoExtension, normalizeArtistVideoInput, validateArtistVideoInput, ARTIST_VIDEO_SOURCE } from '../../src/lib/artistVideos.js'
import { isOtherArtist } from '../../src/lib/publicVisibility.js'

const VIDEO_BASE_URL = process.env.VIDEO_BASE_URL || process.env.VITE_VIDEO_BASE_URL || ''

function formatVideoRow(row) {
  const videoExtension = getStaticArtistVideoExtension(row.videoUrl)
  const resolvedVideoUrl = row.sourceType === ARTIST_VIDEO_SOURCE.UPLOAD
    ? buildStaticArtistVideoPath(row.artist?.slug, VIDEO_BASE_URL, videoExtension)
    : row.videoUrl

  return {
    ...row,
    videoUrl: resolvedVideoUrl,
    posterPreviewUrl: buildClientImageUrl({ url: row.posterUrl, pathname: row.posterPathname }),
  }
}

async function ensureArtistVideoRows(session) {
  const artists = await prisma.artist.findMany({
    where: isSuperAdmin(session) || !session.artistId ? undefined : { id: session.artistId },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      portrait: true,
      order: true,
      videos: {
        take: 1,
      },
    },
  })

  const visibleArtists = artists.filter((artist) => !isOtherArtist(artist))
  const missingArtists = visibleArtists.filter((artist) => !artist.videos?.length)

  if (missingArtists.length) {
    await prisma.artistVideo.createMany({
      data: missingArtists.map((artist) => ({ artistId: artist.id })),
      skipDuplicates: true,
    })
  }

  return prisma.artist.findMany({
    where: isSuperAdmin(session) || !session.artistId ? undefined : { id: session.artistId },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      portrait: true,
      order: true,
      videos: {
        take: 1,
      },
    },
  })
}

export default async function handler(req, res) {
  const session = requireAdmin(req, res)
  if (!session) return
  if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    const artists = await ensureArtistVideoRows(session)

    return res.status(200).json(
      artists
        .filter((artist) => !isOtherArtist(artist))
        .map((artist) => formatVideoRow({
          artist,
          ...(artist.videos[0] ?? {
            id: null,
            artistId: artist.id,
            title: null,
            description: null,
            posterUrl: null,
            posterPathname: null,
            sourceType: null,
            youtubeUrl: null,
            videoUrl: null,
            videosPageUrl: null,
            createdAt: null,
            updatedAt: null,
          }),
        }))
    )
  }

  if (req.method === 'PUT') {
    if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
    const { artistId } = req.query
    const targetArtistId = typeof artistId === 'string' && artistId ? artistId : session.artistId
    if (!targetArtistId) return res.status(400).json({ error: 'Artist id is required' })
    if (!canAccessArtist(session, targetArtistId)) return res.status(403).json({ error: 'Forbidden' })

    const artist = await prisma.artist.findUnique({
      where: { id: targetArtistId },
      select: { id: true, slug: true },
    })
    if (!artist || isOtherArtist(artist)) return res.status(404).json({ error: 'Artist not found' })

    const normalized = normalizeArtistVideoInput({
      ...req.body,
      artistId: targetArtistId,
    })
    const videoExtension = getStaticArtistVideoExtension(normalized.videoUrl)
    const payload = normalized.sourceType === ARTIST_VIDEO_SOURCE.UPLOAD
      ? {
          ...normalized,
          youtubeUrl: null,
          videoUrl: buildStaticArtistVideoPath(artist.slug, VIDEO_BASE_URL, videoExtension),
        }
      : normalized
    const validationError = validateArtistVideoInput(payload)
    if (validationError) return res.status(400).json({ error: validationError })

    const updated = await prisma.artistVideo.upsert({
      where: { artistId: targetArtistId },
      create: payload,
      update: payload,
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            slug: true,
            portrait: true,
            order: true,
          },
        },
      },
    })

    return res.status(200).json(formatVideoRow(updated))
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
