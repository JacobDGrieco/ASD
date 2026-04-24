import { prisma } from '../../src/lib/prisma.js'
import { requireAdmin } from '../../src/lib/auth.js'
import { clientImages, mergeLegacyImages, normalizeImageInput, primaryImageReference, toImageCreateManyData } from '../../src/lib/images.js'

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
  }
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  const { id } = req.query

  if (id) {
    if (req.method === 'PUT') {
      const { name, slug, bio, aboutMe, order, soundcloudProfile, spotifyProfile, appleMusicProfile, images } = req.body
      const normalizedImages = normalizeImageInput(images, 'portrait')
      const artist = await prisma.artist.update({
        where: { id },
        data: {
          name,
          slug,
          bio,
          aboutMe,
          portrait: primaryImageReference(normalizedImages),
          order,
          soundcloudProfile,
          spotifyProfile,
          appleMusicProfile,
          images: {
            deleteMany: {},
            createMany: {
              data: toImageCreateManyData(normalizedImages),
            },
          },
        },
        include: {
          images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
        },
      })
      return res.status(200).json(withImages(artist))
    }
    if (req.method === 'DELETE') {
      await prisma.artist.delete({ where: { id } })
      return res.status(204).end()
    }
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const artists = await prisma.artist.findMany({
      orderBy: { order: 'asc' },
      include: {
        images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    })
    return res.status(200).json(artists.map(withImages))
  }
  if (req.method === 'POST') {
    const { name, slug, bio, aboutMe, order, soundcloudProfile, spotifyProfile, appleMusicProfile, images } = req.body
    const normalizedImages = normalizeImageInput(images, 'portrait')
    const artist = await prisma.artist.create({
      data: {
        name,
        slug,
        bio: bio ?? '',
        aboutMe: aboutMe ?? '',
        portrait: primaryImageReference(normalizedImages),
        order: order ?? 0,
        soundcloudProfile,
        spotifyProfile,
        appleMusicProfile,
        images: normalizedImages.length
          ? {
              createMany: {
                data: toImageCreateManyData(normalizedImages),
              },
            }
          : undefined,
      },
      include: {
        images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    })
    return res.status(201).json(withImages(artist))
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
