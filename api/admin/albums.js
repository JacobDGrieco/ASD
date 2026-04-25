import { prisma } from '../../src/lib/prisma.js'
import { requireAdmin } from '../../src/lib/auth.js'
import { clientImages, mergeLegacyImages, normalizeImageInput, primaryImageReference, toImageCreateManyData } from '../../src/lib/images.js'
import { slugify } from '../../src/lib/slugify.js'

function withImages(album) {
  const images = clientImages(mergeLegacyImages(album.images, album.coverArt, {
    fallbackUsage: 'cover',
    altText: album.title,
    idPrefix: album.id,
  }))
  const primaryImage = images.find((image) => image.isPrimary) ?? images[0]
  return {
    ...album,
    coverArt: primaryImage?.previewUrl ?? album.coverArt,
    images,
  }
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  const { id } = req.query

  if (id) {
    if (req.method === 'PUT') {
      const { title, slug, type, aboutText, soundcloudUrl, spotifyUrl, appleMusicUrl, releaseDate, artistId, images } = req.body
      const normalizedImages = normalizeImageInput(images, 'cover')
      const album = await prisma.album.update({
        where: { id },
        data: {
          title,
          slug: slug || slugify(title),
          type,
          coverArt: primaryImageReference(normalizedImages),
          aboutText: aboutText ?? '',
          soundcloudUrl: soundcloudUrl || null,
          spotifyUrl: spotifyUrl || null,
          appleMusicUrl: appleMusicUrl || null,
          releaseDate: new Date(releaseDate),
          artistId,
          images: {
            deleteMany: {},
            createMany: {
              data: toImageCreateManyData(normalizedImages),
            },
          },
        },
        include: {
          artist: { select: { name: true, slug: true } },
          images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
        },
      })
      return res.status(200).json(withImages(album))
    }
    if (req.method === 'DELETE') {
      await prisma.album.delete({ where: { id } })
      return res.status(204).end()
    }
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const albums = await prisma.album.findMany({
      orderBy: { releaseDate: 'desc' },
      include: {
        artist: { select: { name: true, slug: true } },
        images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    })
    return res.status(200).json(albums.map(withImages))
  }
  if (req.method === 'POST') {
    const { title, slug, type, aboutText, soundcloudUrl, spotifyUrl, appleMusicUrl, releaseDate, artistId, images } = req.body
    const normalizedImages = normalizeImageInput(images, 'cover')
    const album = await prisma.album.create({
      data: {
        title,
        slug: slug || slugify(title),
        type,
        coverArt: primaryImageReference(normalizedImages),
        aboutText: aboutText ?? '',
        soundcloudUrl: soundcloudUrl || null,
        spotifyUrl: spotifyUrl || null,
        appleMusicUrl: appleMusicUrl || null,
        releaseDate: new Date(releaseDate),
        artistId,
        images: normalizedImages.length
          ? {
              createMany: {
                data: toImageCreateManyData(normalizedImages),
              },
            }
          : undefined,
      },
      include: {
        artist: { select: { name: true, slug: true } },
        images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    })
    return res.status(201).json(withImages(album))
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
