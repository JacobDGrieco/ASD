import { prisma } from '../../src/lib/prisma.js'
import { artistScopedAlbumWhere, isSuperAdmin, requireAdmin } from '../../src/lib/auth.js'
import { clientImages, mergeLegacyImages, normalizeImageInput, primaryImageReference, toImageCreateManyData } from '../../src/lib/images.js'
import { OTHER_ARTIST_NAME, OTHER_ARTIST_OPTION_ID, OTHER_ARTIST_SLUG } from '../../src/lib/publicVisibility.js'
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

function withListImages(album) {
  const previewImage = album.images?.[0] ?? null
  const images = previewImage
    ? clientImages(mergeLegacyImages([previewImage], album.coverArt, {
        fallbackUsage: 'cover',
        altText: album.title,
        idPrefix: album.id,
      }))
    : []

  return {
    ...album,
    coverArt: images[0]?.previewUrl ?? album.coverArt,
    images,
    imageCount: album._count?.images ?? images.length,
  }
}

function includeAlbum() {
  return {
    artist: { select: { id: true, name: true, slug: true } },
    images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  }
}

function includeAlbumList() {
  return {
    id: true,
    title: true,
    slug: true,
    type: true,
    otherArtistName: true,
    coverArt: true,
    soundcloudUrl: true,
    spotifyUrl: true,
    appleMusicUrl: true,
    youtubeUrl: true,
    releaseDate: true,
    artistId: true,
    artist: { select: { id: true, name: true, slug: true } },
    images: {
      take: 1,
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
    },
    _count: {
      select: { images: true },
    },
  }
}

function normalizeAlbumDuplicateValue(value) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeAlbumReleaseDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

async function findDuplicateAlbum({ id, title, releaseDate, resolvedArtistId, otherArtistName }) {
  const candidates = await prisma.album.findMany({
    where: {
      ...(id ? { id: { not: id } } : {}),
      artistId: resolvedArtistId,
    },
    select: {
      id: true,
      title: true,
      releaseDate: true,
      otherArtistName: true,
    },
  })

  const normalizedTitle = normalizeAlbumDuplicateValue(title)
  const normalizedOtherArtistName = normalizeAlbumDuplicateValue(otherArtistName)
  const normalizedReleaseDate = normalizeAlbumReleaseDate(releaseDate)

  return candidates.find((album) => (
    normalizeAlbumDuplicateValue(album.title) === normalizedTitle &&
    normalizeAlbumDuplicateValue(album.otherArtistName) === normalizedOtherArtistName &&
    normalizeAlbumReleaseDate(album.releaseDate) === normalizedReleaseDate
  )) ?? null
}

function buildAlbumSlug({ title, artistSlugPart, releaseDate }) {
  const slugParts = [title]

  if (artistSlugPart) slugParts.push(artistSlugPart)

  if (releaseDate) slugParts.push(normalizeAlbumReleaseDate(releaseDate))

  return slugify(slugParts.filter(Boolean).join('-'))
}

async function loadAlbumForSession(session, id) {
  return prisma.album.findFirst({
    where: {
      id,
      ...artistScopedAlbumWhere(session),
    },
    include: includeAlbum(),
  })
}

async function resolveAlbumArtistId(session, artistId) {
  if (!isSuperAdmin(session)) return session.artistId
  if (!artistId) return null
  if (artistId !== OTHER_ARTIST_OPTION_ID) return artistId

  const otherArtist = await prisma.artist.upsert({
    where: { slug: OTHER_ARTIST_SLUG },
    update: { name: OTHER_ARTIST_NAME },
    create: {
      name: OTHER_ARTIST_NAME,
      slug: OTHER_ARTIST_SLUG,
      order: 999999,
    },
    select: { id: true },
  })

  return otherArtist.id
}

async function resolveAlbumArtistSlugPart(artistId, otherArtistName, resolvedArtistId) {
  if (artistId === OTHER_ARTIST_OPTION_ID) return otherArtistName?.trim() || OTHER_ARTIST_NAME
  if (!resolvedArtistId) return ''

  const artist = await prisma.artist.findUnique({
    where: { id: resolvedArtistId },
    select: { slug: true },
  })

  return artist?.slug ?? resolvedArtistId
}

export default async function handler(req, res) {
  const session = requireAdmin(req, res)
  if (!session) return

  const { id } = req.query

  if (id) {
    const existingAlbum = await loadAlbumForSession(session, id)
    if (!existingAlbum) return res.status(404).json({ error: 'Album not found' })

    if (req.method === 'GET') {
      return res.status(200).json(withImages(existingAlbum))
    }

    if (req.method === 'PUT') {
      const { title, type, otherArtistName, aboutText, soundcloudUrl, spotifyUrl, appleMusicUrl, youtubeUrl, releaseDate, artistId, images } = req.body
      const resolvedArtistId = await resolveAlbumArtistId(session, artistId)
      if (!resolvedArtistId) return res.status(400).json({ error: 'Artist is required.' })
      const duplicateAlbum = await findDuplicateAlbum({ id, title, releaseDate, resolvedArtistId, otherArtistName: artistId === OTHER_ARTIST_OPTION_ID ? otherArtistName : '' })
      if (duplicateAlbum) {
        return res.status(409).json({ error: 'An album with this title, artist, and release date already exists.' })
      }
      const artistSlugPart = await resolveAlbumArtistSlugPart(artistId, otherArtistName, resolvedArtistId)
      const normalizedImages = normalizeImageInput(images, 'cover')
      const album = await prisma.album.update({
        where: { id },
        data: {
          title,
          slug: buildAlbumSlug({ title, artistSlugPart, releaseDate }),
          type,
          otherArtistName: artistId === OTHER_ARTIST_OPTION_ID ? otherArtistName?.trim() || null : null,
          coverArt: primaryImageReference(normalizedImages),
          aboutText: aboutText ?? '',
          soundcloudUrl: soundcloudUrl || null,
          spotifyUrl: spotifyUrl || null,
          appleMusicUrl: appleMusicUrl || null,
          youtubeUrl: youtubeUrl || null,
          releaseDate: new Date(releaseDate),
          artistId: resolvedArtistId,
          images: {
            deleteMany: {},
            createMany: {
              data: toImageCreateManyData(normalizedImages),
            },
          },
        },
        include: includeAlbum(),
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
      where: artistScopedAlbumWhere(session),
      orderBy: { releaseDate: 'desc' },
      select: includeAlbumList(),
    })
    return res.status(200).json(albums.map(withListImages))
  }

  if (req.method === 'POST') {
    const { title, type, otherArtistName, aboutText, soundcloudUrl, spotifyUrl, appleMusicUrl, youtubeUrl, releaseDate, artistId, images } = req.body
    const resolvedArtistId = await resolveAlbumArtistId(session, artistId)
    if (!resolvedArtistId) return res.status(400).json({ error: 'Artist is required.' })
    const duplicateAlbum = await findDuplicateAlbum({ title, releaseDate, resolvedArtistId, otherArtistName: artistId === OTHER_ARTIST_OPTION_ID ? otherArtistName : '' })
    if (duplicateAlbum) {
      return res.status(409).json({ error: 'An album with this title, artist, and release date already exists.' })
    }
    const artistSlugPart = await resolveAlbumArtistSlugPart(artistId, otherArtistName, resolvedArtistId)
    const normalizedImages = normalizeImageInput(images, 'cover')
    const album = await prisma.album.create({
      data: {
        title,
        slug: buildAlbumSlug({ title, artistSlugPart, releaseDate }),
        type,
        otherArtistName: artistId === OTHER_ARTIST_OPTION_ID ? otherArtistName?.trim() || null : null,
        coverArt: primaryImageReference(normalizedImages),
        aboutText: aboutText ?? '',
        soundcloudUrl: soundcloudUrl || null,
        spotifyUrl: spotifyUrl || null,
        appleMusicUrl: appleMusicUrl || null,
        youtubeUrl: youtubeUrl || null,
        releaseDate: new Date(releaseDate),
        artistId: resolvedArtistId,
        images: normalizedImages.length
          ? {
              createMany: {
                data: toImageCreateManyData(normalizedImages),
              },
            }
          : undefined,
      },
      include: includeAlbum(),
    })
    return res.status(201).json(withImages(album))
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
