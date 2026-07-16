import { prisma } from '../src/lib/prisma.js'
import { isEffectivelyVisible } from '../src/lib/contentVisibility.js'
import { clientImage, clientImages, mergeLegacyImages } from '../src/lib/images.js'
import { ARTIST_LEGACY_LINK_FIELDS, FASHION_TALENT_LEGACY_LINK_FIELDS, MUSIC_RELEASE_LEGACY_LINK_FIELDS, profileLinksForSource } from '../src/lib/profileLinks.js'
import { formatCrosshairVideo } from '../src/lib/crosshairVideos.js'
import { hasPublicBoardSource, isOtherArtist, isReservedHiddenArtist, OTHER_ARTIST_SLUG } from '../src/lib/publicVisibility.js'
import { isReleasedOnUtcDay } from '../src/lib/releaseSchedule.js'
import { COMPANY_LEADERS, COMPANY_SUMMARY } from '../src/lib/companyProfile.js'

const DEFAULT_COMPANY_TITLE = COMPANY_SUMMARY.title
const DEFAULT_COMPANY_BIO = COMPANY_SUMMARY.description

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

function formatCompanyMember(member) {
  const image = member.imageUrl
    ? clientImage({
        id: `${member.id}-image`,
        url: member.imageUrl,
        pathname: member.imagePathname,
        usage: 'portrait',
        altText: member.name,
        sortOrder: 0,
        isPrimary: true,
      })
    : null

  return {
    id: member.id,
    name: member.name,
    role: member.role,
    bio: member.bio,
    imageUrl: image?.previewUrl ?? '',
    image,
    isVisible: member.isVisible,
    sortOrder: member.sortOrder,
  }
}

function fallbackCompanyAbout() {
  return {
    profile: {
      title: DEFAULT_COMPANY_TITLE,
      bio: DEFAULT_COMPANY_BIO,
    },
    members: COMPANY_LEADERS.map((member, index) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      bio: member.bio ?? member.blurb ?? '',
      imageUrl: member.imageUrl,
      image: {
        id: `${member.id}-fallback-image`,
        url: member.imageUrl,
        pathname: null,
        usage: 'portrait',
        altText: member.name,
        sortOrder: 0,
        isPrimary: true,
        previewUrl: member.imageUrl,
      },
      isVisible: true,
      sortOrder: index,
    })),
  }
}

async function getCompanyAbout(res) {
  setPublicCache(res)
  let profile
  let members

  try {
    ;[profile, members] = await Promise.all([
      prisma.companyProfile.findUnique({ where: { id: 'main' } }),
      prisma.companyMember.findMany({
        where: { isVisible: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    ])
  } catch (error) {
    if (error?.code === 'P2021' || error?.code === 'P2022') {
      return res.status(200).json(fallbackCompanyAbout())
    }

    throw error
  }

  return res.status(200).json({
    profile: {
      title: profile?.title || DEFAULT_COMPANY_TITLE,
      bio: profile?.bio || DEFAULT_COMPANY_BIO,
    },
    members: members.map(formatCompanyMember),
  })
}

function publicArtistSelect() {
  return {
    id: true,
    name: true,
    slug: true,
    isVisible: true,
    portrait: true,
    images: {
      take: 1,
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
    },
  }
}

function formatPublicArtistReference(artist) {
  if (!artist) return artist
  const images = formatArtistImages(artist)
  return {
    ...artist,
    links: profileLinksForSource(artist, ARTIST_LEGACY_LINK_FIELDS),
    portrait: images[0]?.previewUrl ?? artist.portrait ?? '',
    images,
    image: images[0] ?? null,
  }
}

function splitRoleCreditNames(value) {
  if (typeof value !== 'string') return []
  const name = value.trim()
  if (!name) return []

  return name
    .split(/\s*(?:;|,|&|\+|\band\b)\s*/i)
    .flatMap((part) => {
      const trimmedPart = part.trim()
      return trimmedPart ? [trimmedPart] : []
    })
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

async function resolveArtistRoleLinks(roles) {
  const names = collectRoleCreditNames(roles)
  const artistIds = [...new Set((Array.isArray(roles) ? roles : []).flatMap((role) => (
    typeof role?.artistId === 'string' && role.artistId ? [role.artistId] : []
  )))]

  if (!names.length && !artistIds.length) return { slugByName: {}, slugById: {} }

  const matched = await prisma.artist.findMany({
    where: {
      isVisible: true,
      OR: [
        ...(artistIds.length ? [{ id: { in: artistIds } }] : []),
        ...names.map((name) => ({
          name: { equals: name, mode: 'insensitive' },
        })),
      ],
    },
    select: publicArtistSelect(),
  })

  return matched.reduce((links, artist) => {
    if (isPublicArtistVisible(artist)) {
      const formattedArtist = formatPublicArtistReference(artist)
      const item = {
        name: formattedArtist.name,
        slug: formattedArtist.slug,
        image: formattedArtist.image,
        portrait: formattedArtist.portrait,
      }
      links.byName[artist.name.trim().toLowerCase()] = item
      links.byId[artist.id] = item
      links.slugByName[artist.name.trim().toLowerCase()] = artist.slug
      links.slugById[artist.id] = artist.slug
    }
    return links
  }, { byName: {}, byId: {}, slugByName: {}, slugById: {} })
}

async function resolveOutsideArtistRoleLinks(roles) {
  const names = collectRoleCreditNames(roles)
  const outsideArtistIds = [...new Set((Array.isArray(roles) ? roles : []).flatMap((role) => (
    typeof role?.outsideArtistId === 'string' && role.outsideArtistId ? [role.outsideArtistId] : []
  )))]

  if (!names.length && !outsideArtistIds.length) return { outsideByName: {}, outsideById: {} }

  const matched = await prisma.musicOutsideArtist.findMany({
    where: {
      OR: [
        ...(outsideArtistIds.length ? [{ id: { in: outsideArtistIds } }] : []),
        ...names.map((name) => ({
          name: { equals: name, mode: 'insensitive' },
        })),
      ],
    },
    select: { id: true, name: true, externalUrl: true, imageUrl: true, pathname: true },
  })

  return matched.reduce((links, artist) => {
    const image = artist.imageUrl
      ? clientImage({
          id: `${artist.id}-image`,
          url: artist.imageUrl,
          pathname: artist.pathname,
          usage: 'portrait',
          altText: artist.name,
          sortOrder: 0,
          isPrimary: true,
        })
      : null
    const item = { name: artist.name, externalUrl: artist.externalUrl || '', image }
    links.outsideByName[artist.name.trim().toLowerCase()] = item
    links.outsideById[artist.id] = item
    return links
  }, { outsideByName: {}, outsideById: {} })
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
    links: profileLinksForSource(displayAlbum, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
    artist: formatPublicArtistReference(displayAlbum.artist),
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

function visiblePlacementSongs(placements, fallbackReleaseDate, now, artistVisible = true) {
  const songs = []
  for (const song of formatPlacementSongs(placements, fallbackReleaseDate, now)) {
    if (!isPublicSongReleased(song, fallbackReleaseDate, now)) continue
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

function resolvePrimaryPlacement(placements) {
  return placements?.[0] ?? null
}

async function getArtists(res) {
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
      links: true,
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
          links: true,
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
      if (!isPublicArtistVisible(artist)) return publicArtists
      const images = formatArtistImages(artist)
      publicArtists.push({
        ...artist,
        links: profileLinksForSource(artist, ARTIST_LEGACY_LINK_FIELDS),
        isPubliclyVisible: isPublicArtistVisible(artist),
        portrait: images[0]?.previewUrl ?? artist.portrait,
        images,
        albums: (artist.albums ?? []).reduce((albums, album) => {
          if (!isPublicAlbumReleased(album, now)) return albums
          const artistVisible = isPublicArtistVisible(artist)
          albums.push({
            ...formatAlbumSummary(album),
            isPubliclyVisible: isPublicAlbumReleased(album, now) && artistVisible,
            songs: visiblePlacementSongs(album.songPlacements, album.releaseDate, now, artistVisible),
          })
          return albums
        }, []),
      })
      return publicArtists
    }, [])
  )
}

async function getArtist(res, slug) {
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
  if (!isPublicArtistVisible(artist)) return res.status(404).json({ error: 'Artist not found' })

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
                  soundcloudUrl: true,
                  spotifyUrl: true,
                  appleMusicUrl: true,
                  youtubeUrl: true,
                  links: true,
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
      if (!isPublicArtistVisible(album.artist)) continue
      if (!isPublicAlbumReleased(album, now)) continue
      if (!isPublicSongReleased({ ...song, releaseDate }, album.releaseDate, now)) continue

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
    links: profileLinksForSource(artist, ARTIST_LEGACY_LINK_FIELDS),
    isPubliclyVisible: isPublicArtistVisible(artist),
    portrait: images[0]?.previewUrl ?? artist.portrait,
    images,
    albums: artist.albums.reduce((albums, album) => {
      if (!isPublicAlbumReleased(album, now)) return albums
      const artistVisible = isPublicArtistVisible(artist)
      albums.push({
        ...formatAlbumSummary(album),
        isPubliclyVisible: isPublicAlbumReleased(album, now) && artistVisible,
        songs: visiblePlacementSongs(album.songPlacements, album.releaseDate, now, artistVisible),
      })
      return albums
    }, []),
    featuredIn,
  })
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

async function getAlbum(res, id) {
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
  if (!isPublicArtistVisible(album.artist)) return res.status(404).json({ error: 'Album not found' })
  if (!isPublicAlbumReleased(album, now)) return res.status(404).json({ error: 'Album not found' })

  const albumImages = formatAlbumImages(album)
  return res.status(200).json({
    ...album,
    links: profileLinksForSource(album, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
    artist: formatPublicArtistReference(album.artist),
    isPubliclyVisible: isPublicAlbumReleased(album, now) && isPublicArtistVisible(album.artist),
    coverArt: albumImages[0]?.previewUrl ?? album.coverArt,
    images: albumImages,
    songs: visiblePlacementSongs(
      album.songPlacements,
      album.releaseDate,
      now,
      isPublicArtistVisible(album.artist),
    ),
  })
}

async function getSong(res, id) {
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
              soundcloudUrl: true,
              spotifyUrl: true,
              appleMusicUrl: true,
              youtubeUrl: true,
              links: true,
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

  const releasedPlacements = song.placements.filter((placement) => (
    isPublicArtistVisible(placement.album.artist) &&
    isPublicAlbumReleased(placement.album, now)
  ))
  const primaryPlacement = resolvePrimaryPlacement(releasedPlacements)
  const requestedPlacement = resolvePrimaryPlacement(song.placements)
  const primaryAlbum = primaryPlacement?.album ?? null
  const songReleaseDate = song.meta?.releaseDate ?? requestedPlacement?.album?.releaseDate ?? null

  if (!requestedPlacement || !isPublicArtistVisible(requestedPlacement.album.artist) || !isPublicAlbumReleased(requestedPlacement.album, now)) {
    return res.status(404).json({ error: 'Song not found' })
  }
  if (!isPublicSongReleased({ ...song, releaseDate: songReleaseDate }, requestedPlacement.album.releaseDate, now)) {
    return res.status(404).json({ error: 'Song not found' })
  }

  if (song.meta && !song.meta.releaseDate && primaryAlbum?.releaseDate) {
    song.meta = { ...song.meta, releaseDate: primaryAlbum.releaseDate }
  }

  if (song.meta) {
    const roles = Array.isArray(song.meta.roles) ? song.meta.roles : []
    const { byName: artistByName, byId: artistById, slugByName, slugById } = await resolveArtistRoleLinks(roles)
    const { outsideByName, outsideById } = await resolveOutsideArtistRoleLinks(roles)

    const roleGroups = {}
    for (const { role, name, artistId, outsideArtistId, externalUrl } of roles) {
      if (!roleGroups[role]) roleGroups[role] = []
      const linkedArtistSlug = artistId ? slugById[artistId] ?? null : null
      if (linkedArtistSlug) {
        roleGroups[role].push(artistById[artistId] ?? { name, slug: linkedArtistSlug })
        continue
      }

      const linkedOutsideArtist = outsideArtistId ? outsideById[outsideArtistId] ?? null : null
      if (linkedOutsideArtist) {
        roleGroups[role].push({
          name: linkedOutsideArtist.name || name,
          slug: null,
          externalUrl: linkedOutsideArtist.externalUrl || externalUrl || '',
          image: linkedOutsideArtist.image ?? null,
        })
        continue
      }

      const names = getRoleCreditDisplayNames(name, slugByName)
      if (!names.length) continue
      for (const displayName of names) {
        const nameKey = displayName.trim().toLowerCase()
        const artist = artistByName[nameKey] ?? null
        const outsideArtist = outsideByName[nameKey] ?? null
        roleGroups[role].push({
          name: displayName,
          slug: artist?.slug ?? slugByName[nameKey] ?? null,
          image: artist?.image ?? outsideArtist?.image ?? null,
          portrait: artist?.portrait ?? '',
          externalUrl: outsideArtist?.externalUrl || (displayName === name ? externalUrl : '') || '',
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
          isPublicArtistVisible(album.artist),
        ),
      },
    }
  })

  if (!placements.length) return res.status(404).json({ error: 'Song not found' })

  const songImages = formatSongImages(song)

  return res.status(200).json({
    ...song,
    links: profileLinksForSource(song, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
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

async function getRecordPlayer(res) {
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
            links: true,
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
                    soundcloudUrl: true,
                    spotifyUrl: true,
                    appleMusicUrl: true,
                    youtubeUrl: true,
                    links: true,
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
        .flatMap((track) => {
          const placement = track.song.placements.find((candidate) => (
            isPublicArtistVisible(candidate.album.artist) &&
            isPublicAlbumReleased(candidate.album, now) &&
            isPublicSongReleased(track.song, candidate.album.releaseDate, now)
          ))
          if (!placement) return []

          const album = formatAlbumSummary(placement.album)
          return [{
            ...track,
            song: {
              ...track.song,
              isPubliclyVisible: isPublicSongReleased(track.song, placement.album.releaseDate, now)
                && isPublicAlbumReleased(placement.album, now)
                && isPublicArtistVisible(placement.album.artist),
              album,
            },
          }]
        })
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
    links: true,
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
  return { ...talent, links: profileLinksForSource(talent, FASHION_TALENT_LEGACY_LINK_FIELDS), images: clientImages(talent.images ?? []) }
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
  const effectiveReleaseDate = look.releaseDate ?? look.collectionPlacements?.[0]?.collection?.releaseDate ?? null
  return {
    id: look.id,
    title: look.title,
    slug: look.slug,
    description: look.description,
    isVisible: look.isVisible,
    releaseDate: look.releaseDate,
    effectiveReleaseDate,
    order: look.order,
    createdAt: look.createdAt,
    updatedAt: look.updatedAt,
    collections: (look.collectionPlacements ?? []).map((placement) => ({
      id: placement.collection.id,
      title: placement.collection.title,
      slug: placement.collection.slug,
      season: placement.collection.season,
      releaseDate: placement.collection.releaseDate,
      sortOrder: placement.sortOrder,
    })),
    images: clientImages(look.images ?? []),
    credits: lookCredits,
    pieces: (look.pieces ?? []).map(formatFashionPiece),
  }
}

async function getFashionTalentList(res) {
  setPublicCache(res)
  const talent = await prisma.fashionTalent.findMany({
    where: { isVisible: true },
    orderBy: { order: 'asc' },
    select: publicFashionTalentSelect(),
  })
  return res.status(200).json(talent.map(formatFashionTalent))
}

async function getFashionTalent(res, slug) {
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
  if (!talent.isVisible) return res.status(404).json({ error: 'Talent not found' })

  const featuredIn = (talent.lookCredits ?? []).reduce((credits, credit) => {
    if (!credit.look?.isVisible) return credits
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
    collectionPlacements: {
      orderBy: { sortOrder: 'asc' },
      include: {
        collection: { select: { id: true, title: true, slug: true, season: true, releaseDate: true } },
      },
    },
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
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    },
    _count: { select: { pieces: true } },
  }
}

function formatLookSummary(look, fallbackReleaseDate = null) {
  const effectiveReleaseDate = look.releaseDate ?? fallbackReleaseDate ?? look.collectionPlacements?.[0]?.collection?.releaseDate ?? null
  return {
    id: look.id,
    title: look.title,
    slug: look.slug,
    order: look.order,
    isVisible: look.isVisible,
    releaseDate: look.releaseDate,
    effectiveReleaseDate,
    createdAt: look.createdAt,
    updatedAt: look.updatedAt,
    images: clientImages(look.images ?? []),
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

async function getFashionCatalogue(res) {
  setPublicCache(res)

  const collections = await prisma.fashionCollection.findMany({
    where: { isVisible: true },
    orderBy: [
      { releaseDate: { sort: 'desc', nulls: 'last' } },
      { order: 'asc' },
      { createdAt: 'asc' },
    ],
    include: {
      lookPlacements: {
        where: { look: { isVisible: true } },
        orderBy: { sortOrder: 'asc' },
        include: {
          look: {
            include: includePublicLookSummary(),
          },
        },
      },
    },
  })

  const collectionItems = collections.flatMap((collection) => {
    const linkedLook = collection.lookPlacements[0]?.look
      ? formatLookSummary(collection.lookPlacements[0].look, collection.releaseDate)
      : null

    if (collection.type === 'LOOSE_LOOK' && !linkedLook) return []

    const looks = collection.type === 'LOOSE_LOOK'
      ? [linkedLook]
      : collection.lookPlacements.map((placement) => formatLookSummary(placement.look, collection.releaseDate))

    return [{
      type: 'collection',
      collectionType: collection.type,
      catalogueType: collection.type === 'LOOSE_LOOK' ? 'loose' : 'collection',
      id: collection.id,
      title: collection.title,
      slug: collection.slug,
      description: collection.description,
      season: collection.season,
      releaseDate: collection.releaseDate,
      effectiveReleaseDate: collection.releaseDate ?? linkedLook?.effectiveReleaseDate ?? null,
      location: collection.location,
      coverImage: collection.coverImage
        ? clientImage({ url: collection.coverImage, pathname: collection.coverPathname })
        : linkedLook?.images?.[0] ?? null,
      isVisible: collection.isVisible,
      order: collection.order,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      linkedLook,
      looks,
    }]
  })

  const all = collectionItems.sort(compareFashionCatalogueItems)
  return res.status(200).json(all)
}

function compareFashionCatalogueItems(left, right) {
  const leftReleaseValue = left.effectiveReleaseDate ?? left.releaseDate
  const rightReleaseValue = right.effectiveReleaseDate ?? right.releaseDate
  const leftRelease = leftReleaseValue ? new Date(leftReleaseValue).getTime() : null
  const rightRelease = rightReleaseValue ? new Date(rightReleaseValue).getTime() : null

  if (leftRelease !== null && rightRelease !== null && leftRelease !== rightRelease) {
    return rightRelease - leftRelease
  }
  if (leftRelease !== null) return -1
  if (rightRelease !== null) return 1

  return (left.order ?? 0) - (right.order ?? 0)
}

async function getFashionCollection(res, slug) {
  setPublicCache(res)

  const collection = await prisma.fashionCollection.findUnique({
    where: { slug },
    include: {
      lookPlacements: {
        where: { look: { isVisible: true } },
        orderBy: { sortOrder: 'asc' },
        include: {
          look: {
            include: includePublicLook(),
          },
        },
      },
      credits: includePublicCollectionCredits(),
    },
  })

  if (!collection) return res.status(404).json({ error: 'Collection not found' })
  if (!collection.isVisible) return res.status(404).json({ error: 'Collection not found' })

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
  for (const placement of (collection.lookPlacements ?? [])) {
    for (const credit of (placement.look?.credits ?? [])) addCredit(credit)
  }

  return res.status(200).json({
    id: collection.id,
    title: collection.title,
    slug: collection.slug,
    description: collection.description,
    about: collection.about,
    type: collection.type,
    season: collection.season,
    releaseDate: collection.releaseDate,
    location: collection.location,
    coverImage: collection.coverImage
      ? clientImage({ url: collection.coverImage, pathname: collection.coverPathname })
      : null,
    isVisible: collection.isVisible,
    order: collection.order,
    looks: collection.lookPlacements.map((placement) => formatFashionLook({
      ...placement.look,
      collectionPlacements: [{
        sortOrder: placement.sortOrder,
        collection: {
          id: collection.id,
          title: collection.title,
          slug: collection.slug,
          season: collection.season,
          releaseDate: collection.releaseDate,
        },
      }],
    })),
    credits: mergedCredits,
  })
}

async function getFashionLooksList(res) {
  setPublicCache(res)
  const looks = await prisma.fashionLook.findMany({
    where: { isVisible: true },
    orderBy: [
      { releaseDate: { sort: 'desc', nulls: 'last' } },
      { order: 'asc' },
    ],
    include: includePublicLook(),
  })
  return res.status(200).json(looks.map(formatFashionLook).sort(compareFashionCatalogueItems))
}

async function getFashionLook(res, slug) {
  setPublicCache(res)
  const look = await prisma.fashionLook.findUnique({
    where: { slug },
    include: includePublicLook(),
  })

  if (!look) return res.status(404).json({ error: 'Look not found' })
  if (!look.isVisible) return res.status(404).json({ error: 'Look not found' })

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

  const resource = typeof req.query.resource === 'string' ? req.query.resource : ''
  const slug = normalizeSlug(req.query.slug)
  const id = typeof req.query.id === 'string' ? req.query.id.trim() : null

  if (resource === 'artists') return getArtists(res)
  if (resource === 'artist' && slug) return getArtist(res, slug)
  if (resource === 'album' && id) return getAlbum(res, id)
  if (resource === 'song' && id) return getSong(res, id)
  if (resource === 'crosshair') return getCrosshairVideos(res)
  if (resource === 'recordPlayer') return getRecordPlayer(res)
  if (resource === 'boardPosts') return getBoardPosts(res)
  if (resource === 'about') return getCompanyAbout(res)
  if (resource === 'fashionTalentList') return getFashionTalentList(res)
  if (resource === 'fashionTalent' && slug) return getFashionTalent(res, slug)
  if (resource === 'fashionLooksList') return getFashionLooksList(res)
  if (resource === 'fashionLook' && slug) return getFashionLook(res, slug)
  if (resource === 'fashionCatalogue') return getFashionCatalogue(res)
  if (resource === 'fashionCollection' && slug) return getFashionCollection(res, slug)

  return res.status(404).json({ error: 'Not found' })
}
