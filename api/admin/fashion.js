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
    tiktokProfile: true,
    twitterProfile: true,
    youtubeProfile: true,
    facebookProfile: true,
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

async function deleteFashionCreditsForPerson(tx, where) {
  await tx.fashionPieceCredit.deleteMany({ where })
  await tx.fashionLookCredit.deleteMany({ where })
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
      const { name, slug, role, bio, order, isVisible, instagramProfile, tiktokProfile, twitterProfile, youtubeProfile, facebookProfile, email, website, agencyName, agencyContact, images } = req.body
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
          tiktokProfile: tiktokProfile || null,
          twitterProfile: twitterProfile || null,
          youtubeProfile: youtubeProfile || null,
          facebookProfile: facebookProfile || null,
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
      await prisma.$transaction(async (tx) => {
        await deleteFashionCreditsForPerson(tx, { talentId: id })
        await tx.fashionTalent.delete({ where: { id } })
      })
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
    const { name, slug, role, bio, order, isVisible, instagramProfile, tiktokProfile, twitterProfile, youtubeProfile, facebookProfile, email, website, agencyName, agencyContact, images } = req.body
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
        tiktokProfile: tiktokProfile || null,
        twitterProfile: twitterProfile || null,
        youtubeProfile: youtubeProfile || null,
        facebookProfile: facebookProfile || null,
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

function selectCrewList() {
  return {
    id: true,
    name: true,
    role: true,
    externalUrl: true,
    imageUrl: true,
    pathname: true,
    createdAt: true,
    updatedAt: true,
  }
}

function withCrewImage(crew) {
  const image = crew.imageUrl
    ? clientImages([{
        id: `${crew.id}-img`,
        url: crew.imageUrl,
        pathname: crew.pathname,
        usage: 'portrait',
        altText: crew.name,
        sortOrder: 0,
        isPrimary: true,
      }])[0]
    : null

  return { ...crew, image }
}

function normalizeExternalUrl(value) {
  const url = typeof value === 'string' ? value.trim() : ''
  if (!url) return ''

  try {
    const parsed = new URL(url.includes('://') ? url : `https://${url}`)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : ''
  } catch {
    return ''
  }
}

async function handleCrew(req, res) {
  const { id } = req.query

  if (id) {
    const existing = await prisma.fashionCrew.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return res.status(404).json({ error: 'Outside talent not found' })

    if (req.method === 'GET') {
      const crew = await prisma.fashionCrew.findUnique({ where: { id }, select: selectCrewList() })
      return res.status(200).json(withCrewImage(crew))
    }

    if (req.method === 'PUT') {
      const { name, role, externalUrl, image } = req.body
      const normalizedImage = normalizeImageInput(image ? [image] : [], 'portrait')
      const imageUrl = primaryImageReference(normalizedImage)
      const pathname = normalizedImage[0]?.pathname ?? null
      const crew = await prisma.fashionCrew.update({
        where: { id },
        data: { name, role: role ?? '', externalUrl: normalizeExternalUrl(externalUrl), imageUrl, pathname: pathname || null },
        select: selectCrewList(),
      })
      return res.status(200).json(withCrewImage(crew))
    }

    if (req.method === 'DELETE') {
      await prisma.$transaction(async (tx) => {
        await deleteFashionCreditsForPerson(tx, { crewId: id })
        await tx.fashionCrew.delete({ where: { id } })
      })
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const crew = await prisma.fashionCrew.findMany({
      orderBy: { createdAt: 'asc' },
      select: selectCrewList(),
    })
    return res.status(200).json(crew.map(withCrewImage))
  }

  if (req.method === 'POST') {
    const { name, role, externalUrl, image } = req.body
    if (!name) return res.status(400).json({ error: 'Name is required.' })
    const normalizedImage = normalizeImageInput(image ? [image] : [], 'portrait')
    const imageUrl = primaryImageReference(normalizedImage)
    const pathname = normalizedImage[0]?.pathname ?? null
    const crew = await prisma.fashionCrew.create({
      data: { name, role: role ?? '', externalUrl: normalizeExternalUrl(externalUrl), imageUrl, pathname: pathname || null },
      select: selectCrewList(),
    })
    return res.status(201).json(withCrewImage(crew))
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

function includeLook() {
  return {
    images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    pieces: {
      orderBy: { sortOrder: 'asc' },
      include: {
        credits: {
          orderBy: { sortOrder: 'asc' },
          include: {
            talent: { select: { id: true, name: true, slug: true, role: true } },
            crew: { select: { id: true, name: true, role: true } },
          },
        },
      },
    },
    credits: {
      orderBy: { sortOrder: 'asc' },
      include: {
        talent: { select: { id: true, name: true, slug: true, role: true } },
        crew: { select: { id: true, name: true, role: true } },
      },
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
      image: piece.imageUrl
        ? clientImages([{
            id: `${piece.id}-image`,
            url: piece.imageUrl,
            pathname: piece.pathname,
            usage: 'piece',
            altText: piece.name,
            sortOrder: 0,
            isPrimary: true,
          }])[0]
        : null,
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

// credits: [{ talentId?, crewId?, creditName, roleLabel }]
function creditsCreateManyData(credits) {
  const normalized = Array.isArray(credits) ? credits : []
  return normalized
    .filter((credit) => credit?.talentId || credit?.crewId || credit?.creditName?.trim())
    .map((credit, index) => ({
      talentId: credit.talentId || null,
      crewId: credit.crewId || null,
      creditName: credit.creditName?.trim() ?? '',
      roleLabel: credit.roleLabel ?? '',
      sortOrder: index,
    }))
}

function normalizedCreditName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function collectUnlinkedCreditNames(credits, namesByKey) {
  for (const credit of Array.isArray(credits) ? credits : []) {
    if (credit?.talentId || credit?.crewId) continue
    const name = normalizedCreditName(credit?.creditName)
    if (!name || namesByKey.has(name)) continue
    namesByKey.set(name, {
      name: String(credit.creditName).trim().replace(/\s+/g, ' '),
      role: credit.roleLabel ?? '',
    })
  }
}

async function resolveTypedOutsideTalentCredits(tx, credits, pieces) {
  const namesByKey = new Map()
  collectUnlinkedCreditNames(credits, namesByKey)
  for (const piece of Array.isArray(pieces) ? pieces : []) {
    collectUnlinkedCreditNames(piece?.credits, namesByKey)
  }

  if (!namesByKey.size) return { credits, pieces }

  const [talent, crew] = await Promise.all([
    tx.fashionTalent.findMany({ select: { id: true, name: true } }),
    tx.fashionCrew.findMany({ select: { id: true, name: true } }),
  ])
  const talentByName = new Map(talent.map((person) => [normalizedCreditName(person.name), person.id]))
  const crewByName = new Map(crew.map((person) => [normalizedCreditName(person.name), person.id]))

  for (const [nameKey, entry] of namesByKey) {
    if (talentByName.has(nameKey) || crewByName.has(nameKey)) continue
    const created = await tx.fashionCrew.create({
      data: {
        name: entry.name,
        role: entry.role,
        externalUrl: '',
        imageUrl: '',
        pathname: null,
      },
      select: { id: true, name: true },
    })
    crewByName.set(normalizedCreditName(created.name), created.id)
  }

  const resolveCredit = (credit) => {
    if (credit?.talentId || credit?.crewId) return credit
    const nameKey = normalizedCreditName(credit?.creditName)
    if (!nameKey) return credit
    const talentId = talentByName.get(nameKey)
    if (talentId) return { ...credit, talentId, crewId: '' }
    const crewId = crewByName.get(nameKey)
    if (crewId) return { ...credit, talentId: '', crewId }
    return credit
  }

  return {
    credits: (Array.isArray(credits) ? credits : []).map(resolveCredit),
    pieces: (Array.isArray(pieces) ? pieces : []).map((piece) => ({
      ...piece,
      credits: (Array.isArray(piece?.credits) ? piece.credits : []).map(resolveCredit),
    })),
  }
}

// pieces: [{ id?, name, buyUrl, image: {...}, credits: [{ talentId?, crewId?, creditName, roleLabel }] }]
function piecesCreateData(pieces) {
  const normalized = Array.isArray(pieces) ? pieces : []
  return normalized.map((piece, index) => {
    const normalizedImage = normalizeImageInput(piece?.image ? [piece.image] : [], 'piece')
    const credits = creditsCreateManyData(piece?.credits)
    return {
      name: piece?.name ?? '',
      buyUrl: piece?.buyUrl || null,
      imageUrl: primaryImageReference(normalizedImage),
      pathname: normalizedImage[0]?.pathname ?? null,
      sortOrder: index,
      credits: credits.length
        ? { createMany: { data: credits } }
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
        const resolved = await resolveTypedOutsideTalentCredits(tx, credits, pieces)
        const lookCredits = creditsCreateManyData(resolved.credits)
        const lookPieces = piecesCreateData(resolved.pieces)

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
            credits: lookCredits.length
              ? { createMany: { data: lookCredits } }
              : undefined,
            pieces: lookPieces.length
              ? { create: lookPieces }
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
    const look = await prisma.$transaction(async (tx) => {
      const resolved = await resolveTypedOutsideTalentCredits(tx, credits, pieces)
      const lookCredits = creditsCreateManyData(resolved.credits)
      const lookPieces = piecesCreateData(resolved.pieces)

      return tx.fashionLook.create({
        data: {
          title,
          slug: slug || slugify(title),
          description: description ?? '',
          order: order ?? 0,
          isVisible: isVisible ?? true,
          images: normalizedImages.length
            ? { createMany: { data: toImageCreateManyData(normalizedImages) } }
            : undefined,
          credits: lookCredits.length
            ? { createMany: { data: lookCredits } }
            : undefined,
          pieces: lookPieces.length
            ? { create: lookPieces }
            : undefined,
        },
        include: includeLook(),
      })
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
  if (resource === 'crew') return handleCrew(req, res)

  return res.status(400).json({ error: 'Unknown fashion resource' })
}
