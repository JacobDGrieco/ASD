import { prisma } from '../src/lib/prisma.js'
import { isEffectivelyVisible } from '../src/lib/contentVisibility.js'
import { verifyToken } from '../src/lib/auth.js'
import { buildClientImageUrl, clientImage, clientImages, mergeLegacyImages } from '../src/lib/images.js'
import { ARTIST_VIDEO_SOURCE, buildStaticArtistVideoPath, getStaticArtistVideoExtension, getYouTubeEmbedUrl } from '../src/lib/artistVideos.js'
import { formatCrosshairVideo } from '../src/lib/crosshairVideos.js'
import { hasPublicBoardSource, isOtherArtist, isReservedHiddenArtist, OTHER_ARTIST_SLUG } from '../src/lib/publicVisibility.js'
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

function splitRoleCreditNames(value) {
  if (typeof value !== 'string') return []
  const name = value.trim()
  if (!name) return []

  return name
    .split(/\s*(?:;|,|&|\+|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
}

function getRoleCreditDisplayNames(name, slugByName) {
  if (typeof name !== 'string') return []
  const trimmedName = name.trim()
  if (!trimmedName) return []
  if (slugByName[trimmedName.toLowerCase()]) return [trimmedName]

  const splitNames = splitRoleCreditNames(trimmedName)
  return splitNames.length > 1 ? splitNames : [trimmedName]
}

function collectRoleCreditNames(roles) {
  const names = []

  for (const role of roles) {
    if (typeof role?.name !== 'string') continue
    const trimmedName = role.name.trim()
    if (!trimmedName) continue
    names.push(trimmedName, ...splitRoleCreditNames(trimmedName))
  }

  return [...new Set(names)]
}

async function resolveArtistLinksByName(names, includeHidden = false) {
  const uniqueNames = []
  const seenNames = new Set()
  for (const value of Array.isArray(names) ? names : []) {
    const name = value.trim()
    if (!name || seenNames.has(name)) continue
    seenNames.add(name)
    uniqueNames.push(name)
  }
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

  return matched.reduce((linksByName, artist) => {
    if (includeHidden || isPublicArtistVisible(artist)) {
      linksByName[artist.name.trim().toLowerCase()] = artist.slug
    }
    return linksByName
  }, {})
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

function visiblePlacementSongs(placements, fallbackReleaseDate, now, includeHidden, artistVisible = true) {
  const songs = []
  for (const song of formatPlacementSongs(placements, fallbackReleaseDate, now)) {
    if (!includeHidden && !isPublicSongReleased(song, fallbackReleaseDate, now)) continue
    songs.push({
      ...song,
      isPubliclyVisible: song.isPubliclyVisible && artistVisible,
    })
  }
  return songs
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
    artists.reduce((publicArtists, artist) => {
      if (!includeHidden && !isPublicArtistVisible(artist)) return publicArtists
      const images = formatArtistImages(artist)
      publicArtists.push({
        ...artist,
        isPubliclyVisible: isPublicArtistVisible(artist),
        portrait: images[0]?.previewUrl ?? artist.portrait,
        images,
        albums: (artist.albums ?? []).reduce((albums, album) => {
          if (!includeHidden && !isPublicAlbumReleased(album, now)) return albums
          const artistVisible = isPublicArtistVisible(artist)
          albums.push({
            ...formatAlbumSummary(album),
            isPubliclyVisible: isPublicAlbumReleased(album, now) && artistVisible,
            songs: visiblePlacementSongs(album.songPlacements, album.releaseDate, now, includeHidden, artistVisible),
          })
          return albums
        }, []),
      })
      return publicArtists
    }, [])
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
    albums: artist.albums.reduce((albums, album) => {
      if (!includeHidden && !isPublicAlbumReleased(album, now)) return albums
      const artistVisible = isPublicArtistVisible(artist)
      albums.push({
        ...formatAlbumSummary(album),
        isPubliclyVisible: isPublicAlbumReleased(album, now) && artistVisible,
        songs: visiblePlacementSongs(album.songPlacements, album.releaseDate, now, includeHidden, artistVisible),
      })
      return albums
    }, []),
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
    videos.reduce((publicVideos, video) => {
      if (!isPublicArtistVisible(video.artist)) return publicVideos
      if (
        (video.sourceType !== 'YOUTUBE' || !video.youtubeUrl) &&
        (video.sourceType !== 'UPLOAD' || !video.videoUrl)
      ) {
        return publicVideos
      }

        const artistImages = formatArtistImages(video.artist)
        publicVideos.push(formatArtistVideo({
          ...video,
          artist: {
            ...video.artist,
            portrait: artistImages[0]?.previewUrl ?? video.artist.portrait,
            images: artistImages,
          },
        }))
        return publicVideos
      }, [])
  )
}

async function getCrosshairVideos(res) {
  setPublicCache(res)
  const now = new Date()
  const videos = await prisma.crosshairVideo.findMany({
    where: {
      isVisible: true,
      OR: [
        { publishedAt: null },
        { publishedAt: { lte: now } },
      ],
    },
    orderBy: [
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  return res.status(200).json(
    videos.reduce((formattedVideos, video) => {
      if (!video.youtubeUrl) return formattedVideos
      const formattedVideo = formatCrosshairVideo(video)
      if (formattedVideo.youtubeEmbedUrl) formattedVideos.push(formattedVideo)
      return formattedVideos
    }, [])
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
    songs: visiblePlacementSongs(
      album.songPlacements,
      album.releaseDate,
      now,
      includeHidden,
      isPublicArtistVisible(album.artist),
    ),
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
              type: true,
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
      },
      meta: true,
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      lyric: {
        include: {
          annotations: {
            orderBy: { createdAt: 'asc' },
            include: { ranges: { orderBy: { startChar: 'asc' } } },
          },
        },
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
    const allNames = collectRoleCreditNames(roles)
    const slugByName = await resolveArtistLinksByName(allNames, includeHidden)

    const roleGroups = {}
    for (const { role, name } of roles) {
      const names = getRoleCreditDisplayNames(name, slugByName)
      if (!names.length) continue
      if (!roleGroups[role]) roleGroups[role] = []
      for (const displayName of names) {
        roleGroups[role].push({
          name: displayName,
          slug: slugByName[displayName.trim().toLowerCase()] ?? null,
        })
      }
    }

    song.meta = { ...song.meta, roleGroups }
  }

  const placements = releasedPlacements.map((placement) => {
    const { songPlacements = [], ...albumRecord } = placement.album
    const album = formatAlbumSummary(albumRecord)
    return {
      albumId: album.id,
      trackNumber: placement.trackNumber,
      discNumber: placement.discNumber,
      placementOrder: placement.placementOrder,
      album: {
        ...album,
        isPubliclyVisible: isPublicAlbumReleased(placement.album, now) && isPublicArtistVisible(placement.album.artist),
        songs: visiblePlacementSongs(
          songPlacements,
          album.releaseDate,
          now,
          includeHidden,
          isPublicArtistVisible(album.artist),
        ),
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

function publicFashionTalentSelect() {
  return {
    id: true,
    name: true,
    slug: true,
    role: true,
    isVisible: true,
    order: true,
    bio: true,
    instagramProfile: true,
    tiktokProfile: true,
    twitterProfile: true,
    youtubeProfile: true,
    facebookProfile: true,
    email: true,
    website: true,
    agencyName: true,
    agencyContact: true,
    createdAt: true,
    updatedAt: true,
    images: {
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
    },
  }
}

function formatFashionTalent(talent) {
  return { ...talent, images: clientImages(talent.images ?? []) }
}

function formatFashionCredit(credit) {
  const talentImages = clientImages(credit.talent?.images ?? [])
  const crewImage = credit.crew?.imageUrl
    ? clientImage({ url: credit.crew.imageUrl, pathname: credit.crew.pathname })
    : null
  return {
    id: credit.id,
    creditName: credit.creditName || credit.talent?.name || credit.crew?.name || '',
    roleLabel: credit.roleLabel,
    image: talentImages[0] ?? crewImage ?? null,
    externalUrl: credit.crew?.externalUrl || '',
    talent: credit.talent ? {
      id: credit.talent.id,
      name: credit.talent.name,
      slug: credit.talent.slug,
      role: credit.talent.role,
    } : null,
  }
}

function formatFashionPiece(piece) {
  const credits = (piece.credits ?? []).map(formatFashionCredit)
  return {
    id: piece.id,
    name: piece.name,
    buyUrl: piece.buyUrl,
    image: piece.imageUrl ? clientImages([{ id: `${piece.id}-image`, url: piece.imageUrl, pathname: piece.pathname, usage: 'piece', altText: piece.name, sortOrder: 0, isPrimary: true }])[0] : null,
    credits,
  }
}

function formatFashionLook(look) {
  const lookCredits = (look.credits ?? []).map(formatFashionCredit)
  return {
    id: look.id,
    title: look.title,
    slug: look.slug,
    description: look.description,
    isVisible: look.isVisible,
    order: look.order,
    createdAt: look.createdAt,
    updatedAt: look.updatedAt,
    images: clientImages(look.images ?? []),
    credits: lookCredits,
    pieces: (look.pieces ?? []).map(formatFashionPiece),
  }
}

async function getFashionTalentList(res, includeHidden) {
  setPublicCache(res)
  const talent = await prisma.fashionTalent.findMany({
    where: includeHidden ? undefined : { isVisible: true },
    orderBy: { order: 'asc' },
    select: publicFashionTalentSelect(),
  })
  return res.status(200).json(talent.map(formatFashionTalent))
}

async function getFashionTalent(res, slug, includeHidden) {
  setPublicCache(res)
  const talent = await prisma.fashionTalent.findUnique({
    where: { slug },
    select: {
      ...publicFashionTalentSelect(),
      lookCredits: {
        orderBy: { sortOrder: 'asc' },
        select: {
          roleLabel: true,
          look: {
            select: {
              id: true,
              title: true,
              slug: true,
              isVisible: true,
              images: {
                orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
                select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
              },
              _count: { select: { pieces: true } },
            },
          },
        },
      },
    },
  })

  if (!talent) return res.status(404).json({ error: 'Talent not found' })
  if (!includeHidden && !talent.isVisible) return res.status(404).json({ error: 'Talent not found' })

  const featuredIn = (talent.lookCredits ?? []).reduce((credits, credit) => {
    if (!includeHidden && !credit.look?.isVisible) return credits
    credits.push({
      roleLabel: credit.roleLabel,
      look: credit.look
        ? {
            id: credit.look.id,
            title: credit.look.title,
            slug: credit.look.slug,
            images: clientImages(credit.look.images ?? []),
            pieces: new Array(credit.look._count?.pieces ?? 0),
          }
        : null,
    })
    return credits
  }, [])

  const rest = { ...talent }
  delete rest.lookCredits
  return res.status(200).json({ ...formatFashionTalent(rest), featuredIn })
}

function includePublicLook() {
  return {
    images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    pieces: {
      orderBy: { sortOrder: 'asc' },
      include: {
        credits: {
          orderBy: { sortOrder: 'asc' },
          include: {
            talent: { select: { id: true, name: true, slug: true, role: true, images: { take: 1, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true } } } },
            crew: { select: { id: true, name: true, role: true, externalUrl: true, imageUrl: true, pathname: true } },
          },
        },
      },
    },
    credits: {
      orderBy: { sortOrder: 'asc' },
      include: {
        talent: { select: { id: true, name: true, slug: true, role: true, images: { take: 1, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true } } } },
        crew: { select: { id: true, name: true, role: true, externalUrl: true, imageUrl: true, pathname: true } },
      },
    },
  }
}

function includePublicLookSummary() {
  return {
    images: {
      take: 1,
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    },
    _count: { select: { pieces: true } },
  }
}

function formatLookSummary(look) {
  const primary = (look.images ?? [])[0]
  return {
    id: look.id,
    title: look.title,
    slug: look.slug,
    order: look.order,
    isVisible: look.isVisible,
    createdAt: look.createdAt,
    updatedAt: look.updatedAt,
    images: primary ? clientImages([primary]) : [],
    pieces: new Array(look._count?.pieces ?? 0),
  }
}

function includePublicCollectionCredits() {
  return {
    orderBy: { sortOrder: 'asc' },
    include: {
      talent: {
        select: {
          id: true,
          name: true,
          slug: true,
          role: true,
          images: {
            take: 1,
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
          },
        },
      },
      crew: { select: { id: true, name: true, role: true, externalUrl: true, imageUrl: true, pathname: true } },
    },
  }
}

async function getFashionCatalogue(res, includeHidden) {
  setPublicCache(res)

  const [collections, looseLooks] = await Promise.all([
    prisma.fashionCollection.findMany({
      where: includeHidden ? undefined : { isVisible: true },
      orderBy: { order: 'asc' },
      include: {
        looks: {
          where: includeHidden ? undefined : { isVisible: true },
          orderBy: { order: 'asc' },
          include: includePublicLookSummary(),
        },
      },
    }),
    prisma.fashionLook.findMany({
      where: { collectionId: null, ...(includeHidden ? {} : { isVisible: true }) },
      orderBy: { order: 'asc' },
      include: includePublicLookSummary(),
    }),
  ])

  const collectionItems = collections.map((collection) => ({
    type: 'collection',
    id: collection.id,
    title: collection.title,
    slug: collection.slug,
    description: collection.description,
    season: collection.season,
    location: collection.location,
    coverImage: collection.coverImage
      ? clientImage({ url: collection.coverImage, pathname: collection.coverPathname })
      : null,
    isVisible: collection.isVisible,
    order: collection.order,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
    looks: collection.looks.map(formatLookSummary),
  }))

  const looseLookItems = looseLooks.map((look) => ({
    type: 'look',
    ...formatLookSummary(look),
  }))

  const all = [...collectionItems, ...looseLookItems].sort((left, right) => left.order - right.order)
  return res.status(200).json(all)
}

async function getFashionCollection(res, slug, includeHidden) {
  setPublicCache(res)

  const collection = await prisma.fashionCollection.findUnique({
    where: { slug },
    include: {
      looks: {
        where: includeHidden ? undefined : { isVisible: true },
        orderBy: { order: 'asc' },
        include: includePublicLook(),
      },
      credits: includePublicCollectionCredits(),
    },
  })

  if (!collection) return res.status(404).json({ error: 'Collection not found' })
  if (!includeHidden && !collection.isVisible) return res.status(404).json({ error: 'Collection not found' })

  const seenKeys = new Set()
  const mergedCredits = []

  function addCredit(credit) {
    const key = credit.talentId
      || (credit.crew ? `crew:${credit.crew.id}` : null)
      || `name:${(credit.creditName || '').toLowerCase().trim()}`
    if (!key || seenKeys.has(key)) return
    seenKeys.add(key)
    mergedCredits.push(formatFashionCredit(credit))
  }

  for (const credit of (collection.credits ?? [])) addCredit(credit)
  for (const look of (collection.looks ?? [])) {
    for (const credit of (look.credits ?? [])) addCredit(credit)
  }

  return res.status(200).json({
    id: collection.id,
    title: collection.title,
    slug: collection.slug,
    description: collection.description,
    about: collection.about,
    season: collection.season,
    location: collection.location,
    coverImage: collection.coverImage
      ? clientImage({ url: collection.coverImage, pathname: collection.coverPathname })
      : null,
    isVisible: collection.isVisible,
    order: collection.order,
    looks: collection.looks.map(formatFashionLook),
    credits: mergedCredits,
  })
}

async function getFashionLooksList(res, includeHidden) {
  setPublicCache(res)
  const looks = await prisma.fashionLook.findMany({
    where: includeHidden ? undefined : { isVisible: true },
    orderBy: { order: 'asc' },
    include: includePublicLook(),
  })
  return res.status(200).json(looks.map(formatFashionLook))
}

async function getFashionLook(res, slug, includeHidden) {
  setPublicCache(res)
  const look = await prisma.fashionLook.findUnique({
    where: { slug },
    include: includePublicLook(),
  })

  if (!look) return res.status(404).json({ error: 'Look not found' })
  if (!includeHidden && !look.isVisible) return res.status(404).json({ error: 'Look not found' })

  return res.status(200).json(formatFashionLook(look))
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
        slug: { not: OTHER_ARTIST_SLUG },
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

  return res.status(200).json(posts.filter((post) => hasPublicBoardSource(post.artist)))
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
  if (resource === 'crosshair') return getCrosshairVideos(res)
  if (resource === 'recordPlayer') return getRecordPlayer(res, includeHidden)
  if (resource === 'boardPosts') return getBoardPosts(res)
  if (resource === 'fashionTalentList') return getFashionTalentList(res, includeHidden)
  if (resource === 'fashionTalent' && slug) return getFashionTalent(res, slug, includeHidden)
  if (resource === 'fashionLooksList') return getFashionLooksList(res, includeHidden)
  if (resource === 'fashionLook' && slug) return getFashionLook(res, slug, includeHidden)
  if (resource === 'fashionCatalogue') return getFashionCatalogue(res, includeHidden)
  if (resource === 'fashionCollection' && slug) return getFashionCollection(res, slug, includeHidden)

  return res.status(404).json({ error: 'Not found' })
}
