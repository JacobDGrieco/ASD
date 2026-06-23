import { prisma } from '../../src/lib/prisma.js'
import { requireSuperAdmin } from '../../src/lib/auth.js'
import { clientImages, normalizeImageInput, primaryImageReference, toImageCreateManyData } from '../../src/lib/images.js'
import { slugify } from '../../src/lib/slugify.js'

// ---------- shared helpers ----------

function includeTalentImages() {
  return { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }
}

function withTalentImages(talent) {
  const images = clientImages(talent.images ?? [])
  return { ...talent, images }
}

function selectTalentList() {
  return {
    id: true,
    name: true,
    slug: true,
    role: true,
    isVisible: true,
    order: true,
    instagramProfile: true,
    email: true,
    website: true,
    agencyName: true,
    agencyContact: true,
    images: {
      take: 1,
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
    },
    _count: { select: { images: true } },
  }
}

function withTalentListImages(talent) {
  const images = clientImages(talent.images ?? [])
  return { ...talent, images, imageCount: talent._count?.images ?? images.length }
}

async function handleTalent(req, res) {
  const { id } = req.query

  if (id) {
    const existing = await prisma.fashionTalent.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return res.status(404).json({ error: 'Talent not found' })

    if (req.method === 'GET') {
      const talent = await prisma.fashionTalent.findUnique({
        where: { id },
        include: { images: includeTalentImages() },
      })
      return res.status(200).json(withTalentImages(talent))
    }

    if (req.method === 'PUT') {
      const { name, slug, role, bio, order, isVisible, instagramProfile, email, website, agencyName, agencyContact, images } = req.body
      const normalizedImages = images === undefined ? null : normalizeImageInput(images, 'portrait')
      const talent = await prisma.fashionTalent.update({
        where: { id },
        data: {
          name,
          slug: slug !== undefined ? (slug || slugify(name)) : undefined,
          role,
          bio,
          order,
          isVisible,
          instagramProfile: instagramProfile || null,
          email: email || null,
          website: website || null,
          agencyName: agencyName || null,
          agencyContact: agencyContact || null,
          images: normalizedImages === null
            ? undefined
            : {
                deleteMany: {},
                createMany: { data: toImageCreateManyData(normalizedImages) },
              },
        },
        include: { images: includeTalentImages() },
      })
      return res.status(200).json(withTalentImages(talent))
    }

    if (req.method === 'DELETE') {
      await prisma.fashionTalent.delete({ where: { id } })
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const talent = await prisma.fashionTalent.findMany({
      orderBy: { order: 'asc' },
      select: selectTalentList(),
    })
    return res.status(200).json(talent.map(withTalentListImages))
  }

  if (req.method === 'POST') {
    const { name, slug, role, bio, order, isVisible, instagramProfile, email, website, agencyName, agencyContact, images } = req.body
    if (!name) return res.status(400).json({ error: 'Name is required.' })
    if (!role) return res.status(400).json({ error: 'Role is required.' })
    const normalizedImages = normalizeImageInput(images, 'portrait')
    const talent = await prisma.fashionTalent.create({
      data: {
        name,
        slug: slug || slugify(name),
        role,
        bio: bio ?? '',
        order: order ?? 0,
        isVisible: isVisible ?? true,
        instagramProfile: instagramProfile || null,
        email: email || null,
        website: website || null,
        agencyName: agencyName || null,
        agencyContact: agencyContact || null,
        images: normalizedImages.length
          ? { createMany: { data: toImageCreateManyData(normalizedImages) } }
          : undefined,
      },
      include: { images: includeTalentImages() },
    })
    return res.status(201).json(withTalentImages(talent))
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ---------- looks ----------

function includeLook() {
  return {
    images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    pieces: {
      orderBy: { sortOrder: 'asc' },
      include: {
        credits: {
          orderBy: { sortOrder: 'asc' },
          include: { talent: { select: { id: true, name: true, slug: true, role: true } } },
        },
      },
    },
    credits: {
      orderBy: { sortOrder: 'asc' },
      include: { talent: { select: { id: true, name: true, slug: true, role: true } } },
    },
  }
}

function selectLookList() {
  return {
    id: true,
    title: true,
    slug: true,
    description: true,
    isVisible: true,
    order: true,
    images: {
      take: 1,
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, url: true, pathname: true, usage: true, altText: true, sortOrder: true, isPrimary: true },
    },
    _count: { select: { images: true, pieces: true } },
  }
}

function withLookImages(look) {
  return {
    ...look,
    images: clientImages(look.images ?? []),
    pieces: (look.pieces ?? []).map((piece) => ({
      ...piece,
      credits: piece.credits ?? [],
    })),
    credits: look.credits ?? [],
  }
}

function withLookListImages(look) {
  return {
    ...look,
    images: clientImages(look.images ?? []),
    imageCount: look._count?.images ?? 0,
    pieceCount: look._count?.pieces ?? 0,
  }
}

// credits: [{ talentId, roleLabel }]
function creditsCreateManyData(credits) {
  const normalized = Array.isArray(credits) ? credits : []
  return normalized
    .filter((credit) => credit?.talentId)
    .map((credit, index) => ({
      talentId: credit.talentId,
      roleLabel: credit.roleLabel ?? '',
      sortOrder: index,
    }))
}

// pieces: [{ id?, name, buyUrl, image: {...}, credits: [{ talentId, roleLabel }] }]
function piecesCreateData(pieces) {
  const normalized = Array.isArray(pieces) ? pieces : []
  return normalized.map((piece, index) => {
    const normalizedImage = normalizeImageInput(piece?.image ? [piece.image] : [], 'piece')
    return {
      name: piece?.name ?? '',
      buyUrl: piece?.buyUrl || null,
      imageUrl: primaryImageReference(normalizedImage),
      pathname: normalizedImage[0]?.pathname ?? null,
      sortOrder: index,
      credits: creditsCreateManyData(piece?.credits).length
        ? { createMany: { data: creditsCreateManyData(piece.credits) } }
        : undefined,
    }
  })
}

async function handleLooks(req, res) {
  const { id } = req.query

  if (id) {
    const existing = await prisma.fashionLook.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return res.status(404).json({ error: 'Look not found' })

    if (req.method === 'GET') {
      const look = await prisma.fashionLook.findUnique({ where: { id }, include: includeLook() })
      return res.status(200).json(withLookImages(look))
    }

    if (req.method === 'PUT') {
      const { title, slug, description, order, isVisible, images, pieces, credits } = req.body
      const normalizedImages = images === undefined ? null : normalizeImageInput(images, 'lookbook')

      // Replace child collections (pieces, piece credits, look credits) wholesale to keep
      // the form-driven CMS simple, matching the same pattern used for Album/Artist image
      // collections. Done as one interactive transaction so a failed update can't strand
      // the Look with its children deleted but not replaced.
      const look = await prisma.$transaction(async (tx) => {
        await tx.fashionPieceCredit.deleteMany({ where: { piece: { lookId: id } } })
        await tx.fashionPiece.deleteMany({ where: { lookId: id } })
        await tx.fashionLookCredit.deleteMany({ where: { lookId: id } })

        return tx.fashionLook.update({
          where: { id },
          data: {
            title,
            slug: slug !== undefined ? (slug || slugify(title)) : undefined,
            description: description ?? '',
            order,
            isVisible,
            images: normalizedImages === null
              ? undefined
              : { deleteMany: {}, createMany: { data: toImageCreateManyData(normalizedImages) } },
            credits: creditsCreateManyData(credits).length
              ? { createMany: { data: creditsCreateManyData(credits) } }
              : undefined,
            pieces: piecesCreateData(pieces).length
              ? { create: piecesCreateData(pieces) }
              : undefined,
          },
          include: includeLook(),
        })
      })
      return res.status(200).json(withLookImages(look))
    }

    if (req.method === 'DELETE') {
      await prisma.fashionLook.delete({ where: { id } })
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const looks = await prisma.fashionLook.findMany({
      orderBy: { order: 'asc' },
      select: selectLookList(),
    })
    return res.status(200).json(looks.map(withLookListImages))
  }

  if (req.method === 'POST') {
    const { title, slug, description, order, isVisible, images, pieces, credits } = req.body
    if (!title) return res.status(400).json({ error: 'Title is required.' })
    const normalizedImages = normalizeImageInput(images, 'lookbook')
    const look = await prisma.fashionLook.create({
      data: {
        title,
        slug: slug || slugify(title),
        description: description ?? '',
        order: order ?? 0,
        isVisible: isVisible ?? true,
        images: normalizedImages.length
          ? { createMany: { data: toImageCreateManyData(normalizedImages) } }
          : undefined,
        credits: creditsCreateManyData(credits).length
          ? { createMany: { data: creditsCreateManyData(credits) } }
          : undefined,
        pieces: piecesCreateData(pieces).length
          ? { create: piecesCreateData(pieces) }
          : undefined,
      },
      include: includeLook(),
    })
    return res.status(201).json(withLookImages(look))
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default async function handler(req, res) {
  const session = requireSuperAdmin(req, res)
  if (!session) return

  const resource = req.query.resource

  if (resource === 'talent') return handleTalent(req, res)
  if (resource === 'looks') return handleLooks(req, res)

  return res.status(400).json({ error: 'Unknown fashion resource' })
}
