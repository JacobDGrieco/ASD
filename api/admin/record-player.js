/**
 * Admin read/write for the home-page vinyl "record player" widget: a fixed set of
 * `RecordPlayerTrack` slots (position -> song), plus (`?resource=songs`) a song
 * search endpoint for picking what goes in each slot. Requires
 * `MUSIC_RECORD_PLAYER` page access; the song search and slot save are blocked for
 * VIEWER sessions (read-only otherwise). A VIEWER's slot list is additionally
 * filtered through `viewerSongVisibilityWhere` so it only shows songs that would
 * actually be publicly visible.
 *
 * `PUT` replaces every slot wholesale (delete-all, recreate) rather than diffing —
 * there's no independent identity to preserve for a slot beyond its position.
 *
 * Server-only (Vercel Function). Consumed by `AdminMusicRecordPlayerPage.jsx`.
 */
import { prisma } from '../../src/lib/prisma.js'
import { canAccessAdminPage, isViewer, requireAdmin, viewerSongVisibilityWhere } from '../../src/lib/auth.js'
import { ADMIN_PAGE_KEYS } from '../../src/lib/adminPageAccess.js'
import { clientImages, mergeLegacyImages } from '../../src/lib/images.js'
import { isOtherArtist, OTHER_ARTIST_NAME } from '../../src/lib/publicVisibility.js'

// Leftover perf-debugging instrumentation — logs timing for every branch of every
// request in production. Not gated behind a dev-only flag; noisy but harmless.
function logTiming(label, startedAt) {
  const duration = Date.now() - startedAt
  console.log(`[record-player] ${label}: ${duration}ms`)
}

function compareLexicographically(left, right) {
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
}

function displayArtistName(album) {
  if (!album) return ''
  if (isOtherArtist(album.artist)) return album.otherArtistName?.trim() || OTHER_ARTIST_NAME
  return album.artist?.name ?? ''
}

function songImageUrl(song) {
  const images = clientImages(mergeLegacyImages(song.images, song.artwork, {
    fallbackUsage: 'artwork',
    altText: song.title,
    idPrefix: song.id,
  }))
  if (images[0]?.previewUrl) return images[0].previewUrl

  const album = song.placements?.[0]?.album
  const albumImages = clientImages(mergeLegacyImages(album?.images, album?.coverArt, {
    fallbackUsage: 'cover',
    altText: album?.title ?? song.title,
    idPrefix: album?.id ?? `${song.id}-album`,
  }))
  return albumImages[0]?.previewUrl ?? ''
}

function toSongOption(song) {
  return {
    id: song.id,
    title: song.title,
    artistName: displayArtistName(song.placements[0]?.album),
    imageUrl: songImageUrl(song),
  }
}

function toRecordPlayerTrackPayload(track) {
  return {
    ...track,
    song: {
      id: track.song.id,
      title: track.song.title,
      slug: track.song.slug,
      soundcloudUrl: track.song.soundcloudUrl,
      imageUrl: songImageUrl(track.song),
    },
  }
}

export default async function handler(req, res) {
  const requestStartedAt = Date.now()
  const authStartedAt = Date.now()
  const session = requireAdmin(req, res)
  logTiming('auth', authStartedAt)
  if (!session) return

  if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.MUSIC_RECORD_PLAYER)) return res.status(403).json({ error: 'Forbidden' })

  const resource = typeof req.query.resource === 'string' ? req.query.resource : ''

  if (req.method === 'GET' && resource === 'songs') {
    if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
    const queryStartedAt = Date.now()
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (query.length < 2) return res.status(200).json([])

    const prismaStartedAt = Date.now()
    const songs = await prisma.song.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          {
            placements: {
              some: {
                album: {
                  otherArtistName: { contains: query, mode: 'insensitive' },
                },
              },
            },
          },
          {
            placements: {
              some: {
                album: {
                  artist: {
                    name: { contains: query, mode: 'insensitive' },
                  },
                },
              },
            },
          },
        ],
      },
      take: 25,
      select: {
        id: true,
        title: true,
        artwork: true,
        images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
        placements: {
          orderBy: [{ placementOrder: 'asc' }],
          take: 1,
          select: {
            album: {
              select: {
                id: true,
                title: true,
                coverArt: true,
                otherArtistName: true,
                images: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                  take: 1,
                },
                artist: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    })
    logTiming(`search prisma q="${query}"`, prismaStartedAt)

    const mapStartedAt = Date.now()
    const options = songs
      .map(toSongOption)
      .sort((left, right) => {
        const artistComparison = compareLexicographically(left.artistName, right.artistName)
        if (artistComparison !== 0) return artistComparison
        return compareLexicographically(left.title, right.title)
      })
    logTiming(`search map q="${query}"`, mapStartedAt)
    logTiming(`search total q="${query}"`, queryStartedAt)
    logTiming(`request total ${req.method} ${req.url}`, requestStartedAt)

    return res.status(200).json(options)
  }

  if (req.method === 'GET') {
    const prismaStartedAt = Date.now()
    const tracks = await prisma.recordPlayerTrack.findMany({
      where: isViewer(session)
        ? {
            song: viewerSongVisibilityWhere(),
          }
        : undefined,
      orderBy: { position: 'asc' },
      include: {
        song: {
          select: {
            id: true,
            title: true,
            slug: true,
            soundcloudUrl: true,
            artwork: true,
            images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
            placements: {
              orderBy: [{ placementOrder: 'asc' }],
              take: 1,
              select: {
                album: {
                  select: {
                    id: true,
                    title: true,
                    coverArt: true,
                    images: {
                      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
    logTiming('slots prisma', prismaStartedAt)

    const mapStartedAt = Date.now()
    const payload = tracks.map(toRecordPlayerTrackPayload)
    logTiming('slots map', mapStartedAt)
    logTiming(`request total ${req.method} ${req.url}`, requestStartedAt)

    return res.status(200).json(payload)
  }
  if (req.method === 'PUT') {
    if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
    const writeStartedAt = Date.now()
    const { tracks } = req.body
    await prisma.recordPlayerTrack.deleteMany()
    await prisma.recordPlayerTrack.createMany({
      data: tracks.map((t) => ({ songId: t.songId, position: Number(t.position), active: t.active ?? true })),
    })
    logTiming('save writes', writeStartedAt)

    const prismaStartedAt = Date.now()
    const updated = await prisma.recordPlayerTrack.findMany({
      orderBy: { position: 'asc' },
      include: {
        song: {
          select: {
            id: true,
            title: true,
            slug: true,
            soundcloudUrl: true,
            artwork: true,
            images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
            placements: {
              orderBy: [{ placementOrder: 'asc' }],
              take: 1,
              select: {
                album: {
                  select: {
                    id: true,
                    title: true,
                    coverArt: true,
                    images: {
                      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
    logTiming('save reload prisma', prismaStartedAt)

    const mapStartedAt = Date.now()
    const payload = updated.map(toRecordPlayerTrackPayload)
    logTiming('save reload map', mapStartedAt)
    logTiming(`request total ${req.method} ${req.url}`, requestStartedAt)

    return res.status(200).json(payload)
  }

  logTiming(`request total ${req.method} ${req.url}`, requestStartedAt)
  return res.status(405).json({ error: 'Method not allowed' })
}
