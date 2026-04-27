import { prisma } from '../../src/lib/prisma.js'
import { canAccessArtist, isSuperAdmin, requireAdmin } from '../../src/lib/auth.js'
import { hashPassword } from '../../src/lib/passwords.js'
import { validateUniqueArtistPassword } from '../../src/lib/adminAccounts.js'
import { clientImages, mergeLegacyImages, normalizeImageInput, primaryImageReference, toImageCreateManyData } from '../../src/lib/images.js'
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
      select: { id: true },
    })

    if (!existingArtist || !canAccessArtist(session, existingArtist.id)) {
      return res.status(404).json({ error: 'Artist not found' })
    }

    if (req.method === 'PUT') {
      const { name, slug, bio, aboutMe, order, soundcloudProfile, spotifyProfile, appleMusicProfile, youtubeProfile, images, adminPassword } = req.body
      const passwordError = isSuperAdmin(session) ? await validateUniqueArtistPassword(adminPassword, id) : null
      if (passwordError) return res.status(400).json({ error: passwordError })
      const normalizedImages = normalizeImageInput(images, 'portrait')
      const artist = await prisma.artist.update({
        where: { id },
        data: {
          name,
          slug: slug || slugify(name),
          bio,
          aboutMe,
          portrait: primaryImageReference(normalizedImages),
          order: isSuperAdmin(session) ? order : undefined,
          soundcloudProfile,
          spotifyProfile,
          appleMusicProfile,
          youtubeProfile,
          adminAccess: isSuperAdmin(session) ? buildAdminAccessUpdate(adminPassword) : undefined,
          images: {
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
      await prisma.artist.delete({ where: { id } })
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const artists = await prisma.artist.findMany({
      where: isSuperAdmin(session) || !session.artistId ? undefined : { id: session.artistId },
      orderBy: { order: 'asc' },
      include: includeArtist(),
    })
    return res.status(200).json(artists.map(withImages))
  }

  if (req.method === 'POST') {
    if (!isSuperAdmin(session)) return res.status(403).json({ error: 'Forbidden' })

    const { name, slug, bio, aboutMe, order, soundcloudProfile, spotifyProfile, appleMusicProfile, youtubeProfile, images, adminPassword } = req.body
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
