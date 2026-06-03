import { prisma } from '../src/lib/prisma.js'
import { isEffectivelyVisible } from '../src/lib/contentVisibility.js'
import { verifyToken } from '../src/lib/auth.js'
import { buildClientImageUrl, clientImages, mergeLegacyImages } from '../src/lib/images.js'
import { ARTIST_VIDEO_SOURCE, buildStaticArtistVideoPath, getStaticArtistVideoExtension, getYouTubeEmbedUrl } from '../src/lib/artistVideos.js'
import { isOtherArtist, isReservedHiddenArtist, OTHER_ARTIST_SLUG } from '../src/lib/publicVisibility.js'
import { isReleasedOnUtcDay } from '../src/lib/releaseSchedule.js'

const VIDEO_BASE_URL = process.env.VIDEO_BASE_URL || process.env.VITE_VIDEO_BASE_URL || ''

function formatArtistImages(artist) {
  return clientImages(
    mergeLegacyImages(artist.images, artist.portrait, {
      fallbackUsage: 'portrait',
      altText: artist.name,
      idPrefix: artist.id,
    })
  )
}

function formatAlbumImages(album) {
  return clientImages(
    mergeLegacyImages(album.images, album.coverArt, {
      fallbackUsage: 'cover',
      altText: album.title,
      idPrefix: album.id ?? album.slug ?? album.title,
    })
  )
}

function formatSongImages(song) {
  return clientImages(
    mergeLegacyImages(song.images, song.artwork, {
      fallbackUsage: 'artwork',
      altText: song.title,
      idPrefix: song.id,
    })
  )
}

function normalizeSlug(value) {
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === 'string' && value ? value : null
}

function setPublicCache(res) {
  res.setHeader('Cache-Control', 'no-store')
}

function readPreviewSession(req) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.slice(7))
}

function publicArtistSelect() {
  return {
    id: true,
    name: true,
    slug: true,
    isVisible: true,
  }
}

function parseCreditNames(value) {
  if (typeof value !== 'string') return []
  return value
    .split(';')
    .map((name) => name.trim())
    .filter(Boolean)
}

async function resolveArtistLinksByName(names, includeHidden = false) {
  const uniqueNames = [...new Set((Array.isArray(names) ? names : []).map((name) => name.trim()).filter(Boolean))]
  if (!uniqueNames.length) return {}

  const matched = await prisma.artist.findMany({
    where: {
      ...(includeHidden ? {} : { isVisible: true }),
      OR: uniqueNames.map((name) => ({
        name: { equals: name, mode: 'insensitive' },
      })),
    },
    select: publicArtistSelect(),
  })

  return Object.fromEntries(
    matched
      .filter((artist) => includeHidden || isPublicArtistVisible(artist))
      .map((artist) => [artist.name.trim().toLowerCase(), artist.slug])
  )
}

function mapArtistLinks(names, slugByName) {
  return names.map((name) => ({
    name,
    slug: slugByName[name.trim().toLowerCase()] ?? null,
  }))
}

function applyPublicArtistName(album) {
  if (!album?.artist || !isOtherArtist(album.artist) || !album.otherArtistName?.trim()) return album

  return {
    ...album,
    artist: {
      ...album.artist,
      name: album.otherArtistName.trim(),
    },
  }
}

function formatAlbumSummary(album) {
  const displayAlbum = applyPublicArtistName(album)
  const albumImages = formatAlbumImages(displayAlbum)
  return {
    ...displayAlbum,
    coverArt: albumImages[0]?.previewUrl ?? displayAlbum.coverArt,
    images: albumImages,
  }
}

function formatPlacementSongs(placements, fallbackReleaseDate = null, now = new Date()) {
  return placements
    .slice()
    .sort((left, right) => {
      if (left.discNumber !== right.discNumber) return left.discNumber - right.discNumber
      if (left.trackNumber !== right.trackNumber) return left.trackNumber - right.trackNumber
      return left.placementOrder - right.placementOrder
    })
    .map((placement) => ({
      id: placement.song.id,
      title: placement.song.title,
      slug: placement.song.slug,
      isVisible: placement.song.isVisible,
      autoShowOnRelease: placement.song.autoShowOnRelease,
      duration: placement.song.duration,
      releaseDate: placement.song.meta?.releaseDate ?? null,
      isPubliclyVisible: isPublicSongReleased({
        ...placement.song,
        releaseDate: placement.song.meta?.releaseDate ?? null,
      }, placement.album?.releaseDate ?? fallbackReleaseDate ?? null, now),
      trackNumber: placement.trackNumber,
      discNumber: placement.discNumber,
      placementOrder: placement.placementOrder,
    }))
}

function isPublicAlbumReleased(album, now) {
  return isReleasedOnUtcDay(album?.releaseDate, now) && isEffectivelyVisible(album, album?.releaseDate, now)
}

function isPublicSongReleased(song, fallbackReleaseDate, now) {
  const releaseDate = song?.releaseDate ?? fallbackReleaseDate
  return isReleasedOnUtcDay(releaseDate, now) && isEffectivelyVisible(song, releaseDate, now)
}

function isPublicArtistVisible(artist) {
  if (!artist) return false
  return !isReservedHiddenArtist(artist) && artist?.isVisible !== false
}

function formatArtistVideo(video) {
  const videoExtension = getStaticArtistVideoExtension(video.videoUrl)
  const resolvedVideoUrl = video.sourceType === ARTIST_VIDEO_SOURCE.UPLOAD
    ? buildStaticArtistVideoPath(video.artist?.slug, VIDEO_BASE_URL, videoExtension)
    : video.videoUrl

  return {
    id: video.id,
    title: video.title,
    description: video.description,
    posterUrl: buildClientImageUrl({ url: video.posterUrl, pathname: video.posterPathname }),
    sourceType: video.sourceType,
    youtubeUrl: video.youtubeUrl,
    youtubeEmbedUrl: getYouTubeEmbedUrl(video.youtubeUrl),
    videoUrl: resolvedVideoUrl,
    videosPageUrl: video.videosPageUrl,
    artist: video.artist,
  }
}

function resolvePrimaryPlacement(placements) {
  return placements?.[0] ?? null
}

async function getArtists(res, includeHidden = false) {
  setPublicCache(res)
  const now = new Date()
  const artists = await prisma.artist.findMany({
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      isVisible: true,
      bio: true,
      portrait: true,
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
      },
      order: true,
      soundcloudProfile: true,
      spotifyProfile: true,
      appleMusicProfile: true,
      youtubeProfile: true,
      instagramProfile: true,
      twitterProfile: true,
      facebookProfile: true,
      tiktokProfile: true,
      snapchatProfile: true,
      youtubeSocialProfile: true,
      albums: {
        orderBy: { releaseDate: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          isVisible: true,
          autoShowOnRelease: true,
          type: true,
          releaseDate: true,
          coverArt: true,
          otherArtistName: true,
          soundcloudUrl: true,
          spotifyUrl: true,
          appleMusicUrl: true,
          youtubeUrl: true,
          images: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
          },
          songPlacements: {
            include: {
              song: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  isVisible: true,
                  autoShowOnRelease: true,
                  duration: true,
                  meta: {
                    select: { releaseDate: true },
                  },
                },
              },
            },
            orderBy: [{ discNumber: 'asc' }, { trackNumber: 'asc' }, { placementOrder: 'asc' }],
          },
        },
      },
    },
  })

  return res.status(200).json(
    artists.map((artist) => {
      const images = formatArtistImages(artist)
      return {
        ...artist,
        isPubliclyVisible: isPublicArtistVisible(artist),
        portrait: images[0]?.previewUrl ?? artist.portrait,
        images,
        albums: (artist.albums ?? [])
          .filter((album) => includeHidden || isPublicAlbumReleased(album, now))
          .map((album) => ({
            ...formatAlbumSummary(album),
            isPubliclyVisible: isPublicAlbumReleased(album, now) && isPublicArtistVisible(artist),
            songs: formatPlacementSongs(album.songPlacements, album.releaseDate, now)
              .map((song) => ({
                ...song,
                isPubliclyVisible: song.isPubliclyVisible && isPublicArtistVisible(artist),
              }))
              .filter((song) => includeHidden || isPublicSongReleased(song, album.releaseDate, now)),
          })),
      }
    }).filter((artist) => includeHidden || isPublicArtistVisible(artist))
  )
}

async function getArtist(res, slug, includeHidden = false) {
  setPublicCache(res)
  const now = new Date()
  const artist = await prisma.artist.findUnique({
    where: { slug },
    include: {
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      albums: {
        orderBy: { releaseDate: 'desc' },
        include: {
          images: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
          songPlacements: {
            include: {
              song: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  isVisible: true,
                  autoShowOnRelease: true,
                  duration: true,
                  meta: {
                    select: { releaseDate: true },
                  },
                },
              },
            },
            orderBy: [{ discNumber: 'asc' }, { trackNumber: 'asc' }, { placementOrder: 'asc' }],
          },
        },
      },
    },
  })

  if (!artist) return res.status(404).json({ error: 'Artist not found' })
  if (!includeHidden && !isPublicArtistVisible(artist)) return res.status(404).json({ error: 'Artist not found' })

  const images = formatArtistImages(artist)

  const featuredMetas = await prisma.songMeta.findMany({
    where: {
      roles: {
        array_contains: [{ role: 'Featured Artist' }],
      },
    },
    select: {
      roles: true,
      releaseDate: true,
      song: {
        select: {
          id: true,
          title: true,
          slug: true,
          isVisible: true,
          autoShowOnRelease: true,
          duration: true,
          placements: {
            orderBy: [{ placementOrder: 'asc' }],
            select: {
              trackNumber: true,
              discNumber: true,
              placementOrder: true,
              album: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  isVisible: true,
                  autoShowOnRelease: true,
                  coverArt: true,
                  otherArtistName: true,
                  releaseDate: true,
                  type: true,
                  images: {
                    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                    select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
                  },
                  artist: { select: publicArtistSelect() },
                },
              },
            },
          },
        },
      },
    },
  })

  const albumMap = new Map()
  for (const { roles, releaseDate, song } of featuredMetas) {
    const rolesArray = Array.isArray(roles) ? roles : []
    const isFeatured = rolesArray.some(
      (r) => r.role === 'Featured Artist' && r.name?.toLowerCase() === artist.name.toLowerCase()
    )
    if (!isFeatured) continue

    for (const placement of song.placements) {
      const album = placement.album
      if (!includeHidden && !isPublicArtistVisible(album.artist)) continue
      if (!includeHidden && !isPublicAlbumReleased(album, now)) continue
      if (!includeHidden && !isPublicSongReleased({ ...song, releaseDate }, album.releaseDate, now)) continue

      if (!albumMap.has(album.id)) {
        albumMap.set(album.id, {
          ...formatAlbumSummary(album),
          isPubliclyVisible: isPublicAlbumReleased(album, now) && isPublicArtistVisible(album.artist),
          songs: [],
        })
      }

      albumMap.get(album.id).songs.push({
        id: song.id,
        title: song.title,
        slug: song.slug,
        duration: song.duration,
        isPubliclyVisible: isPublicSongReleased({ ...song, releaseDate }, album.releaseDate, now) && isPublicAlbumReleased(album, now) && isPublicArtistVisible(album.artist),
        trackNumber: placement.trackNumber,
        discNumber: placement.discNumber,
        placementOrder: placement.placementOrder,
      })
    }
  }

  const featuredIn = Array.from(albumMap.values()).map((album) => ({
    ...album,
    songs: album.songs.sort((left, right) => {
      if (left.discNumber !== right.discNumber) return left.discNumber - right.discNumber
      if (left.trackNumber !== right.trackNumber) return left.trackNumber - right.trackNumber
      return left.placementOrder - right.placementOrder
    }),
  }))

  return res.status(200).json({
    ...artist,
    isPubliclyVisible: isPublicArtistVisible(artist),
    portrait: images[0]?.previewUrl ?? artist.portrait,
    images,
    albums: artist.albums
      .filter((album) => includeHidden || isPublicAlbumReleased(album, now))
      .map((album) => ({
        ...formatAlbumSummary(album),
        isPubliclyVisible: isPublicAlbumReleased(album, now) && isPublicArtistVisible(artist),
        songs: formatPlacementSongs(album.songPlacements, album.releaseDate, now)
          .map((song) => ({
            ...song,
            isPubliclyVisible: song.isPubliclyVisible && isPublicArtistVisible(artist),
          }))
          .filter((song) => includeHidden || isPublicSongReleased(song, album.releaseDate, now)),
      })),
    featuredIn,
  })
}

async function getVideos(res) {
  setPublicCache(res)
  const videos = await prisma.artistVideo.findMany({
    where: {
      artist: {
        slug: {
          not: OTHER_ARTIST_SLUG,
        },
      },
    },
    orderBy: [
      { artist: { order: 'asc' } },
      { artist: { name: 'asc' } },
    ],
    select: {
      id: true,
      title: true,
      description: true,
      posterUrl: true,
      posterPathname: true,
      sourceType: true,
      youtubeUrl: true,
      videoUrl: true,
      videosPageUrl: true,
      artist: {
        select: {
          id: true,
          name: true,
          slug: true,
          isVisible: true,
          bio: true,
          portrait: true,
          images: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
          },
          order: true,
        },
      },
    },
  })

  return res.status(200).json(
    videos
      .filter((video) => isPublicArtistVisible(video.artist))
      .filter((video) => (
        (video.sourceType === 'YOUTUBE' && video.youtubeUrl) ||
        (video.sourceType === 'UPLOAD' && video.videoUrl)
      ))
      .map((video) => {
        const artistImages = formatArtistImages(video.artist)
        return formatArtistVideo({
          ...video,
          artist: {
            ...video.artist,
            portrait: artistImages[0]?.previewUrl ?? video.artist.portrait,
            images: artistImages,
          },
        })
      })
  )
}

async function getAlbum(res, id, includeHidden = false) {
  setPublicCache(res)
  const now = new Date()
  const album = await prisma.album.findUnique({
    where: { id },
    include: {
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      artist: { select: publicArtistSelect() },
      songPlacements: {
        include: {
          song: {
            select: {
              id: true,
              title: true,
              slug: true,
              isVisible: true,
              autoShowOnRelease: true,
              duration: true,
              meta: {
                select: { releaseDate: true },
              },
            },
          },
        },
        orderBy: [{ discNumber: 'asc' }, { trackNumber: 'asc' }, { placementOrder: 'asc' }],
      },
    },
  })

  if (!album) return res.status(404).json({ error: 'Album not found' })
  if (!includeHidden && !isPublicArtistVisible(album.artist)) return res.status(404).json({ error: 'Album not found' })
  if (!includeHidden && !isPublicAlbumReleased(album, now)) return res.status(404).json({ error: 'Album not found' })

  const albumImages = formatAlbumImages(album)
  return res.status(200).json({
    ...album,
    isPubliclyVisible: isPublicAlbumReleased(album, now) && isPublicArtistVisible(album.artist),
    coverArt: albumImages[0]?.previewUrl ?? album.coverArt,
    images: albumImages,
    songs: formatPlacementSongs(album.songPlacements, album.releaseDate, now)
      .map((song) => ({
        ...song,
        isPubliclyVisible: song.isPubliclyVisible && isPublicArtistVisible(album.artist),
      }))
      .filter((song) => includeHidden || isPublicSongReleased(song, album.releaseDate, now)),
  })
}

async function getSong(res, id, includeHidden = false) {
  setPublicCache(res)
  const now = new Date()
  const song = await prisma.song.findUnique({
    where: { id },
    include: {
      placements: {
        orderBy: [{ placementOrder: 'asc' }],
        include: {
          album: {
            select: {
              id: true,
              title: true,
              slug: true,
              isVisible: true,
              autoShowOnRelease: true,
              coverArt: true,
              otherArtistName: true,
              releaseDate: true,
              images: {
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
              },
              artist: { select: publicArtistSelect() },
            },
          },
        },
      },
      meta: true,
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      lyricBlocks: {
        orderBy: { blockOrder: 'asc' },
        include: { annotations: { orderBy: { startChar: 'asc' } } },
      },
    },
  })

  if (!song) return res.status(404).json({ error: 'Song not found' })

  const releasedPlacements = song.placements.filter((placement) =>
    includeHidden || (
      isPublicArtistVisible(placement.album.artist) &&
      isPublicAlbumReleased(placement.album, now)
    )
  )
  const primaryPlacement = resolvePrimaryPlacement(releasedPlacements)
  const requestedPlacement = resolvePrimaryPlacement(song.placements)
  const primaryAlbum = primaryPlacement?.album ?? null
  const songReleaseDate = song.meta?.releaseDate ?? requestedPlacement?.album?.releaseDate ?? null

  if (!requestedPlacement || (!includeHidden && (!isPublicArtistVisible(requestedPlacement.album.artist) || !isPublicAlbumReleased(requestedPlacement.album, now)))) {
    return res.status(404).json({ error: 'Song not found' })
  }
  if (!includeHidden && !isPublicSongReleased({ ...song, releaseDate: songReleaseDate }, requestedPlacement.album.releaseDate, now)) {
    return res.status(404).json({ error: 'Song not found' })
  }

  if (song.meta && !song.meta.releaseDate && primaryAlbum?.releaseDate) {
    song.meta = { ...song.meta, releaseDate: primaryAlbum.releaseDate }
  }

  if (song.meta) {
    const roles = Array.isArray(song.meta.roles) ? song.meta.roles : []
    const allNames = [...new Set(roles.map((r) => r.name).filter(Boolean))]
    const slugByName = await resolveArtistLinksByName(allNames, includeHidden)

    const roleGroups = {}
    for (const { role, name } of roles) {
      if (!name?.trim()) continue
      if (!roleGroups[role]) roleGroups[role] = []
      roleGroups[role].push({ name, slug: slugByName[name.trim().toLowerCase()] ?? null })
    }

    song.meta = { ...song.meta, roleGroups }
  }

  const placements = releasedPlacements.map((placement) => {
    const album = formatAlbumSummary(placement.album)
    return {
      albumId: album.id,
      trackNumber: placement.trackNumber,
      discNumber: placement.discNumber,
      placementOrder: placement.placementOrder,
      album: {
        ...album,
        isPubliclyVisible: isPublicAlbumReleased(placement.album, now) && isPublicArtistVisible(placement.album.artist),
      },
    }
  })

  if (!placements.length) return res.status(404).json({ error: 'Song not found' })

  const songImages = formatSongImages(song)

  return res.status(200).json({
    ...song,
    isPubliclyVisible: isPublicSongReleased({ ...song, releaseDate: songReleaseDate }, requestedPlacement.album.releaseDate, now)
      && isPublicAlbumReleased(requestedPlacement.album, now)
      && isPublicArtistVisible(requestedPlacement.album.artist),
    album: placements.find((placement) => placement.album.slug === primaryAlbum?.slug)?.album ?? placements[0]?.album ?? null,
    albumId: primaryPlacement?.albumId ?? '',
    trackNumber: primaryPlacement?.trackNumber ?? null,
    discNumber: primaryPlacement?.discNumber ?? null,
    placements,
    albumIds: placements.map((placement) => placement.albumId),
    trackNumbers: placements.map((placement) => placement.trackNumber),
    discNumbers: placements.map((placement) => placement.discNumber),
    artwork: songImages[0]?.previewUrl ?? song.artwork,
    images: songImages,
  })
}

async function getRecordPlayer(res, includeHidden = false) {
  try {
    setPublicCache(res)
    const now = new Date()
    const tracks = await prisma.recordPlayerTrack.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
      include: {
        song: {
          select: {
            id: true,
            title: true,
            slug: true,
            isVisible: true,
            autoShowOnRelease: true,
            soundcloudUrl: true,
            youtubeUrl: true,
            meta: {
              select: { releaseDate: true },
            },
            placements: {
              orderBy: [{ placementOrder: 'asc' }],
              include: {
                album: {
                  select: {
                    isVisible: true,
                    autoShowOnRelease: true,
                    coverArt: true,
                    title: true,
                    otherArtistName: true,
                    releaseDate: true,
                    images: {
                      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                      select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
                    },
                    artist: { select: { name: true, slug: true, isVisible: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    return res.status(200).json(
      tracks
        .map((track) => {
          const placement = track.song.placements.find((candidate) => (
            includeHidden || (
              isPublicArtistVisible(candidate.album.artist) &&
              isPublicAlbumReleased(candidate.album, now) &&
              isPublicSongReleased(track.song, candidate.album.releaseDate, now)
            )
          ))
          if (!placement) return null

          const album = formatAlbumSummary(placement.album)
          return {
            ...track,
            song: {
              ...track.song,
              isPubliclyVisible: isPublicSongReleased(track.song, placement.album.releaseDate, now)
                && isPublicAlbumReleased(placement.album, now)
                && isPublicArtistVisible(placement.album.artist),
              album,
            },
          }
        })
        .filter(Boolean)
    )
  } catch (error) {
    console.error('Record player route failed', error)
    return res.status(500).json({ error: 'Record player unavailable' })
  }
}

async function getBoardPosts(res) {
  setPublicCache(res)
  const now = new Date()
  const ageCap = new Date()
  ageCap.setDate(ageCap.getDate() - 90)

  const posts = await prisma.boardPost.findMany({
    where: {
      publishedAt: { not: null, lte: now },
      archivedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      AND: [{ publishedAt: { gte: ageCap } }],
      artist: {
        isVisible: true,
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: 25,
    select: {
      id: true,
      title: true,
      headline: true,
      body: true,
      imageUrl: true,
      posX: true,
      posY: true,
      rotation: true,
      positionPinnedUntil: true,
      pinColor: true,
      publishedAt: true,
      artist: { select: publicArtistSelect() },
    },
  })

  return res.status(200).json(posts.filter((post) => isPublicArtistVisible(post.artist)))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const previewSession = readPreviewSession(req)
  const includeHidden = Boolean(previewSession)

  const resource = typeof req.query.resource === 'string' ? req.query.resource : ''
  const slug = normalizeSlug(req.query.slug)
  const id = typeof req.query.id === 'string' ? req.query.id.trim() : null

  if (resource === 'artists') return getArtists(res, includeHidden)
  if (resource === 'artist' && slug) return getArtist(res, slug, includeHidden)
  if (resource === 'album' && id) return getAlbum(res, id, includeHidden)
  if (resource === 'song' && id) return getSong(res, id, includeHidden)
  if (resource === 'videos') return getVideos(res)
  if (resource === 'recordPlayer') return getRecordPlayer(res, includeHidden)
  if (resource === 'boardPosts') return getBoardPosts(res)

  return res.status(404).json({ error: 'Not found' })
}
