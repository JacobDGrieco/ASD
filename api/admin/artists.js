import { prisma } from '../../src/lib/prisma.js'
import { canAccessArtist, isSuperAdmin, isViewer, requireAdmin } from '../../src/lib/auth.js'
import { hashPassword } from '../../src/lib/passwords.js'
import { validateUniqueArtistPassword } from '../../src/lib/adminAccounts.js'
import { clientImages, mergeLegacyImages, normalizeImageInput, primaryImageReference, toImageCreateManyData } from '../../src/lib/images.js'
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

  const { id } = req.query

  if (id) {
    const existingArtist = await prisma.artist.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    })

    if (!existingArtist || !canAccessArtist(session, existingArtist.id)) {
      return res.status(404).json({ error: 'Artist not found' })
    }

    if (req.method === 'PUT') {
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
        images,
        adminPassword,
      } = req.body
      const passwordError = isSuperAdmin(session) ? await validateUniqueArtistPassword(adminPassword, id) : null
      if (passwordError) return res.status(400).json({ error: passwordError })
      const normalizedImages = images === undefined ? null : normalizeImageInput(images, 'portrait')
      const artist = await prisma.artist.update({
        where: { id },
        data: {
          name,
          slug: slug !== undefined ? (slug || slugify(name)) : undefined,
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
      return res.status(200).json(withImages(artist))
    }

    if (req.method === 'DELETE') {
      if (!isSuperAdmin(session)) return res.status(403).json({ error: 'Forbidden' })
      if (isReservedHiddenArtist(existingArtist)) return res.status(403).json({ error: 'This reserved artist cannot be deleted here.' })
      await prisma.artist.delete({ where: { id } })
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
      artists
        .filter((artist) => !isReservedHiddenArtist(artist))
        .map(withListImages)
    )
  }

  if (req.method === 'POST') {
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
      images,
      adminPassword,
    } = req.body
    if (isReservedHiddenArtist(slug || name)) return res.status(400).json({ error: 'This artist name is reserved.' })
    const passwordError = await validateUniqueArtistPassword(adminPassword)
    if (passwordError) return res.status(400).json({ error: passwordError })
    const normalizedImages = normalizeImageInput(images, 'portrait')
    const artist = await prisma.artist.create({
      data: {
        name,
        slug: slug || slugify(name),
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
        adminAccess: adminPassword
          ? {
              create: {
                passwordHash: hashPassword(adminPassword),
                active: true,
              },
            }
          : undefined,
        videos: {
          create: {},
        },
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
