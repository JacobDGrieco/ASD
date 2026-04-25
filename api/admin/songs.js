import { prisma } from '../../src/lib/prisma.js'
import { requireAdmin } from '../../src/lib/auth.js'
import { slugify } from '../../src/lib/slugify.js'
import { clientImages, mergeLegacyImages, normalizeImageInput, primaryImageReference, toImageCreateManyData } from '../../src/lib/images.js'

function withImages(song) {
  const images = clientImages(mergeLegacyImages(song.images, song.artwork, {
    fallbackUsage: 'artwork',
    altText: song.title,
    idPrefix: song.id,
  }))

  return {
    ...song,
    artwork: images[0]?.previewUrl ?? song.artwork,
    images,
  }
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return
  const { id } = req.query

  if (id) {
    if (req.method === 'PUT') {
      const { title, slug, trackNumber, discNumber, duration, soundcloudUrl, spotifyUrl, appleMusicUrl, albumId, aboutText, producers, writers, featuredArtists, releaseDate, images, tags } = req.body
      const normalizedImages = normalizeImageInput(images, 'artwork')
      const song = await prisma.song.update({
        where: { id },
        data: {
          title,
          slug: slug || slugify(title),
          trackNumber: Number(trackNumber),
          discNumber: Number(discNumber ?? 1),
          duration,
          artwork: primaryImageReference(normalizedImages),
          soundcloudUrl,
          spotifyUrl,
          appleMusicUrl,
          albumId,
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
      await prisma.songMeta.upsert({
        where: { songId: id },
        create: {
          songId: id,
          aboutText: aboutText ?? '',
          producers: producers ?? '',
          writers: writers ?? '',
          featuredArtists: featuredArtists ?? '',
          tags: Array.isArray(tags) ? tags : [],
          releaseDate: releaseDate ? new Date(releaseDate) : null,
        },
        update: {
          aboutText,
          producers,
          writers,
          featuredArtists,
          tags: Array.isArray(tags) ? tags : [],
          releaseDate: releaseDate ? new Date(releaseDate) : null,
        },
      })
      return res.status(200).json(withImages(song))
    }
    if (req.method === 'DELETE') {
      await prisma.song.delete({ where: { id } })
      return res.status(204).end()
    }
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const songs = await prisma.song.findMany({
      orderBy: [{ album: { artist: { order: 'asc' } } }, { album: { releaseDate: 'desc' } }, { discNumber: 'asc' }, { trackNumber: 'asc' }],
      include: {
        album: { select: { title: true, releaseDate: true, artistId: true, artist: { select: { name: true } } } },
        meta: true,
        images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    })
    return res.status(200).json(songs.map(withImages))
  }
  if (req.method === 'POST') {
    const { title, slug, trackNumber, discNumber, duration, soundcloudUrl, spotifyUrl, appleMusicUrl, albumId, aboutText, producers, writers, featuredArtists, releaseDate, images, tags } = req.body
    const normalizedImages = normalizeImageInput(images, 'artwork')
    const song = await prisma.song.create({
      data: {
        title,
        slug: slug || slugify(title),
        trackNumber: Number(trackNumber),
        discNumber: Number(discNumber ?? 1),
        duration: duration ?? '',
        artwork: primaryImageReference(normalizedImages),
        soundcloudUrl,
        spotifyUrl,
        appleMusicUrl,
        albumId,
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
    await prisma.songMeta.create({
      data: {
        songId: song.id,
        aboutText: aboutText ?? '',
        producers: producers ?? '',
        writers: writers ?? '',
        featuredArtists: featuredArtists ?? '',
        tags: Array.isArray(tags) ? tags : [],
        releaseDate: releaseDate ? new Date(releaseDate) : null,
      },
    })
    return res.status(201).json(withImages(song))
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
