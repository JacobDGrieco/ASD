import { prisma } from '../../src/lib/prisma.js'
import { canAccessAdminPage, canAccessArtist, isSuperAdmin, isViewer, requireAdmin } from '../../src/lib/auth.js'
import { ADMIN_PAGE_KEYS } from '../../src/lib/adminPageAccess.js'
import { hashPassword } from '../../src/lib/passwords.js'
import { validateUniqueArtistPassword } from '../../src/lib/adminAccounts.js'
import { handleAdminBoard } from '../../src/lib/adminBoardHandler.js'
import { collectBlobPathnames, deleteRemovedBlobPathnames, deleteUnusedBlobPathnames } from '../../src/lib/blobCleanup.js'
import { extractBoardBodyImagePathnames } from '../../src/lib/boardMarkdown.js'
import { clientImages, mergeLegacyImages, normalizeImageInput, primaryImageReference, toImageCreateManyData } from '../../src/lib/images.js'
import { ARTIST_LEGACY_LINK_FIELDS, legacyFieldsFromProfileLinks, normalizeProfileLinks, profileLinksForSource } from '../../src/lib/profileLinks.js'
import { isReservedHiddenArtist } from '../../src/lib/publicVisibility.js'
import { slugify } from '../../src/lib/slugify.js'

function withImages(artist) {
  const images = clientImages(mergeLegacyImages(artist.images, artist.portrait, {
    fallbackUsage: 'portrait',
    altText: artist.name,
    idPrefix: artist.id,
  }))

  const primaryImage = images.find((image) => image.isPrimary) ?? images[0]
  return {
    ...artist,
    links: profileLinksForSource(artist, ARTIST_LEGACY_LINK_FIELDS),
    portrait: primaryImage?.previewUrl ?? artist.portrait,
    images,
    hasAdminPassword: Boolean(artist.adminAccess?.active),
  }
}

function includeArtist() {
  return {
    images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    adminAccess: {
      select: {
        active: true,
      },
    },
  }
}

function selectArtistList() {
  return {
    id: true,
    name: true,
    slug: true,
    isVisible: true,
    portrait: true,
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
    images: {
      take: 1,
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
    },
    _count: {
      select: { images: true },
    },
    adminAccess: {
      select: {
        active: true,
      },
    },
  }
}

function withListImages(artist) {
  const previewImage = artist.images?.[0] ?? null
  const images = previewImage
    ? clientImages(mergeLegacyImages([previewImage], artist.portrait, {
        fallbackUsage: 'portrait',
        altText: artist.name,
        idPrefix: artist.id,
      }))
    : []

  return {
    ...artist,
    links: profileLinksForSource(artist, ARTIST_LEGACY_LINK_FIELDS),
    portrait: images[0]?.previewUrl ?? artist.portrait,
    images,
    imageCount: artist._count?.images ?? images.length,
    hasAdminPassword: Boolean(artist.adminAccess?.active),
  }
}

function buildAdminAccessUpdate(adminPassword) {
  if (adminPassword === undefined) return undefined

  return {
    upsert: {
      create: {
        passwordHash: hashPassword(adminPassword),
        active: true,
      },
      update: {
        passwordHash: hashPassword(adminPassword),
        active: true,
      },
    },
  }
}

export default async function handler(req, res) {
  const session = requireAdmin(req, res)
  if (!session) return
  if (req.query.resource === 'board') {
    if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.BOARD)) return res.status(403).json({ error: 'Forbidden' })
    return handleAdminBoard(req, res, session)
  }

  const canReadArtists = [
    ADMIN_PAGE_KEYS.MUSIC_ARTISTS,
    ADMIN_PAGE_KEYS.MUSIC_ALBUMS,
    ADMIN_PAGE_KEYS.MUSIC_SONGS,
    ADMIN_PAGE_KEYS.MUSIC_RECORD_PLAYER,
  ].some((pageKey) => canAccessAdminPage(session, pageKey))
  if (!canReadArtists) return res.status(403).json({ error: 'Forbidden' })

  const { id } = req.query

  if (id) {
    const existingArtist = await prisma.artist.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        portrait: true,
        images: { select: { url: true, pathname: true } },
        videos: { select: { posterUrl: true, posterPathname: true } },
        albums: {
          select: {
            coverArt: true,
            images: { select: { url: true, pathname: true } },
          },
        },
        boardPosts: { select: { imageUrl: true, body: true } },
      },
    })

    if (!existingArtist || !canAccessArtist(session, existingArtist.id)) {
      return res.status(404).json({ error: 'Artist not found' })
    }

    if (req.method === 'PUT') {
      if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.MUSIC_ARTISTS)) return res.status(403).json({ error: 'Forbidden' })
      if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
      if (isReservedHiddenArtist(existingArtist)) return res.status(403).json({ error: 'This reserved artist cannot be edited here.' })
      const {
        name,
        slug,
        bio,
        aboutMe,
        order,
        soundcloudProfile,
        spotifyProfile,
        appleMusicProfile,
        youtubeProfile,
        instagramProfile,
        twitterProfile,
        facebookProfile,
        tiktokProfile,
        snapchatProfile,
        youtubeSocialProfile,
        links,
        isVisible,
        images,
        adminPassword,
      } = req.body
      const passwordError = isSuperAdmin(session) ? await validateUniqueArtistPassword(adminPassword, id) : null
      if (passwordError) return res.status(400).json({ error: passwordError })
      const normalizedImages = images === undefined ? null : normalizeImageInput(images, 'portrait')
      const normalizedLinks = links === undefined ? undefined : normalizeProfileLinks(links)
      const legacyLinkFields = normalizedLinks === undefined ? undefined : legacyFieldsFromProfileLinks(normalizedLinks, ARTIST_LEGACY_LINK_FIELDS)
      const artist = await prisma.artist.update({
        where: { id },
        data: {
          name,
          slug: slug !== undefined ? (slug || slugify(name)) : undefined,
          isVisible,
          bio,
          aboutMe,
          portrait: normalizedImages === null ? undefined : primaryImageReference(normalizedImages),
          order: isSuperAdmin(session) ? order : undefined,
          soundcloudProfile,
          spotifyProfile,
          appleMusicProfile,
          youtubeProfile,
          instagramProfile,
          twitterProfile,
          facebookProfile,
          tiktokProfile,
          snapchatProfile,
          youtubeSocialProfile,
          links: normalizedLinks,
          ...(legacyLinkFields ?? {}),
          adminAccess: isSuperAdmin(session) ? buildAdminAccessUpdate(adminPassword) : undefined,
          images: normalizedImages === null
            ? undefined
            : {
                deleteMany: {},
                createMany: {
                  data: toImageCreateManyData(normalizedImages),
                },
              },
        },
        include: includeArtist(),
      })
      if (normalizedImages !== null) {
        await deleteRemovedBlobPathnames([existingArtist.images, existingArtist.portrait], normalizedImages)
      }
      return res.status(200).json(withImages(artist))
    }

    if (req.method === 'DELETE') {
      if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.MUSIC_ARTISTS)) return res.status(403).json({ error: 'Forbidden' })
      if (!isSuperAdmin(session)) return res.status(403).json({ error: 'Forbidden' })
      if (isReservedHiddenArtist(existingArtist)) return res.status(403).json({ error: 'This reserved artist cannot be deleted here.' })
      const blobPathnames = collectBlobPathnames(
        existingArtist.images,
        existingArtist.portrait,
        existingArtist.videos.map((video) => [video.posterPathname, video.posterUrl]),
        existingArtist.albums.map((album) => [album.images, album.coverArt]),
        existingArtist.boardPosts.map((post) => [
          post.imageUrl,
          [...extractBoardBodyImagePathnames(post.body)],
        ]),
      )
      await prisma.artist.delete({ where: { id } })
      await deleteUnusedBlobPathnames(blobPathnames)
      return res.status(204).end()
    }

    if (req.method === 'GET') {
      const artist = await prisma.artist.findUnique({
        where: { id },
        include: includeArtist(),
      })
      return res.status(200).json(withImages(artist))
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const artists = await prisma.artist.findMany({
      where: isSuperAdmin(session) || !session.artistId
        ? undefined
        : { id: session.artistId },
      orderBy: { order: 'asc' },
      select: selectArtistList(),
    })
    return res.status(200).json(
      artists.reduce((visibleArtists, artist) => {
        if (!isReservedHiddenArtist(artist)) visibleArtists.push(withListImages(artist))
        return visibleArtists
      }, [])
    )
  }

  if (req.method === 'POST') {
    if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.MUSIC_ARTISTS)) return res.status(403).json({ error: 'Forbidden' })
    if (isViewer(session)) return res.status(403).json({ error: 'Forbidden' })
    if (!isSuperAdmin(session)) return res.status(403).json({ error: 'Forbidden' })

    const {
      name,
      slug,
      bio,
      aboutMe,
      order,
      soundcloudProfile,
      spotifyProfile,
      appleMusicProfile,
      youtubeProfile,
      instagramProfile,
      twitterProfile,
      facebookProfile,
      tiktokProfile,
      snapchatProfile,
      youtubeSocialProfile,
      links,
      isVisible,
      images,
      adminPassword,
    } = req.body
    if (isReservedHiddenArtist(slug || name)) return res.status(400).json({ error: 'This artist name is reserved.' })
    const passwordError = await validateUniqueArtistPassword(adminPassword)
    if (passwordError) return res.status(400).json({ error: passwordError })
    const normalizedImages = normalizeImageInput(images, 'portrait')
    const normalizedLinks = links === undefined ? profileLinksForSource(req.body, ARTIST_LEGACY_LINK_FIELDS) : normalizeProfileLinks(links)
    const legacyLinkFields = legacyFieldsFromProfileLinks(normalizedLinks, ARTIST_LEGACY_LINK_FIELDS)
    const artist = await prisma.artist.create({
      data: {
        name,
        slug: slug || slugify(name),
        isVisible: isVisible ?? true,
        bio: bio ?? '',
        aboutMe: aboutMe ?? '',
        portrait: primaryImageReference(normalizedImages),
        order: order ?? 0,
        soundcloudProfile,
        spotifyProfile,
        appleMusicProfile,
        youtubeProfile,
        instagramProfile,
        twitterProfile,
        facebookProfile,
        tiktokProfile,
        snapchatProfile,
        youtubeSocialProfile,
        links: normalizedLinks,
        ...legacyLinkFields,
        adminAccess: adminPassword
          ? {
              create: {
                passwordHash: hashPassword(adminPassword),
                active: true,
              },
            }
          : undefined,
        images: normalizedImages.length
          ? {
              createMany: {
                data: toImageCreateManyData(normalizedImages),
              },
            }
          : undefined,
      },
      include: includeArtist(),
    })
    return res.status(201).json(withImages(artist))
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
