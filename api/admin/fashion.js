/**
 * Consolidated admin handler for three fashion resources, routed by
 * `?resource=talent|crew|looks`: talent profiles, "crew" (outside/freelance
 * credits not on the talent roster), and looks (the individual editorial
 * lookbook entries with pieces and credits).
 *
 * Permission model (`canAccessFashionResource`): talent/crew reads are shared
 * across whichever fashion page needs them for a picker; talent/crew writes are
 * SUPER_ADMIN only (`talentProfileWhere`/`isSuperAdmin` checks); looks are scoped
 * to the look's `creatorTalentId` for TALENT-role sessions via
 * `fashionProjectCreatorWhere` (a talent can only edit looks they created).
 *
 * Business rule shared with `fashionCollections.js`: a credit entered with a
 * free-text name that doesn't match an existing Talent/Crew record silently
 * creates a new `FashionCrew` row (`resolveTypedOutsideTalentCredits`) — there's
 * no separate "register a new person" confirmation step.
 *
 * Server-only (Vercel Function). Consumed by `AdminFashionTalentPage.jsx`,
 * `AdminFashionOutsideTalentPage.jsx`, `AdminFashionLooksPage.jsx`, and the
 * `CrewPickerField`/`CreditsField` components.
 */
import { prisma } from '../../src/lib/prisma.js'
import { canAccessAdminPage, isSuperAdmin, isTalentAdmin, requireAdmin } from '../../src/lib/auth.js'
import { ADMIN_PAGE_KEYS } from '../../src/lib/adminPageAccess.js'
import { collectBlobPathnames, deleteRemovedBlobPathnames, deleteUnusedBlobPathnames } from '../../src/lib/blobCleanup.js'
import { clientImages, normalizeImageInput, primaryImageReference, toImageCreateManyData } from '../../src/lib/images.js'
import { FASHION_TALENT_LEGACY_LINK_FIELDS, legacyFieldsFromProfileLinks, normalizeProfileLinks, profileLinksForSource } from '../../src/lib/profileLinks.js'
import { slugify } from '../../src/lib/slugify.js'

// ---------- shared helpers ----------

function includeTalentImages() {
  return { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }
}

function withTalentImages(talent) {
  const images = clientImages(talent.images ?? [])
  return { ...talent, links: profileLinksForSource(talent, FASHION_TALENT_LEGACY_LINK_FIELDS), images }
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
    links: true,
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
  return { ...talent, links: profileLinksForSource(talent, FASHION_TALENT_LEGACY_LINK_FIELDS), images, imageCount: talent._count?.images ?? images.length }
}

async function deleteFashionCreditsForPerson(tx, where) {
  await tx.fashionPieceCredit.deleteMany({ where })
  await tx.fashionLookCredit.deleteMany({ where })
}

function talentProfileWhere(session) {
  if (isSuperAdmin(session)) return {}
  if (isTalentAdmin(session)) return { AND: [{ id: session.talentId }] }
  return { AND: [{ id: '__no_access__' }] }
}

function fashionProjectCreatorWhere(session) {
  if (isSuperAdmin(session)) return {}
  if (isTalentAdmin(session)) return { creatorTalentId: session.talentId }
  return { AND: [{ id: '__no_access__' }] }
}

async function handleTalent(req, res, session) {
  const { id } = req.query

  if (id) {
    const existing = await prisma.fashionTalent.findFirst({
      where: { id, ...talentProfileWhere(session) },
      select: { id: true, images: { select: { url: true, pathname: true } } },
    })
    if (!existing) return res.status(404).json({ error: 'Talent not found' })

    if (req.method === 'GET') {
      const talent = await prisma.fashionTalent.findFirst({
        where: { id, ...talentProfileWhere(session) },
        include: { images: includeTalentImages() },
      })
      return res.status(200).json(withTalentImages(talent))
    }

    if (req.method === 'PUT') {
      const { name, slug, role, bio, order, isVisible, instagramProfile, tiktokProfile, twitterProfile, youtubeProfile, facebookProfile, email, website, links, agencyName, agencyContact, images } = req.body
      const normalizedImages = images === undefined ? null : normalizeImageInput(images, 'portrait')
      const normalizedLinks = links === undefined ? undefined : normalizeProfileLinks(links)
      const legacyLinkFields = normalizedLinks === undefined ? undefined : legacyFieldsFromProfileLinks(normalizedLinks, FASHION_TALENT_LEGACY_LINK_FIELDS)
      const talent = await prisma.fashionTalent.update({
        where: { id },
        data: {
          name,
          slug: slug !== undefined ? (slug || slugify(name)) : undefined,
          role,
          bio,
          order: isSuperAdmin(session) ? order : undefined,
          isVisible,
          instagramProfile: instagramProfile || null,
          tiktokProfile: tiktokProfile || null,
          twitterProfile: twitterProfile || null,
          youtubeProfile: youtubeProfile || null,
          facebookProfile: facebookProfile || null,
          email: email || null,
          website: website || null,
          links: normalizedLinks,
          ...(legacyLinkFields ?? {}),
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
      if (normalizedImages !== null) {
        await deleteRemovedBlobPathnames(existing.images, normalizedImages)
      }
      return res.status(200).json(withTalentImages(talent))
    }

    if (req.method === 'DELETE') {
      if (!isSuperAdmin(session)) return res.status(403).json({ error: 'Forbidden' })
      await prisma.$transaction(async (tx) => {
        await deleteFashionCreditsForPerson(tx, { talentId: id })
        await tx.fashionTalent.delete({ where: { id } })
      })
      await deleteUnusedBlobPathnames(collectBlobPathnames(existing.images))
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const talent = await prisma.fashionTalent.findMany({
      where: talentProfileWhere(session),
      orderBy: { order: 'asc' },
      select: selectTalentList(),
    })
    return res.status(200).json(talent.map(withTalentListImages))
  }

  if (req.method === 'POST') {
    if (!isSuperAdmin(session)) return res.status(403).json({ error: 'Forbidden' })
    const { name, slug, role, bio, order, isVisible, instagramProfile, tiktokProfile, twitterProfile, youtubeProfile, facebookProfile, email, website, links, agencyName, agencyContact, images } = req.body
    if (!name) return res.status(400).json({ error: 'Name is required.' })
    if (!role) return res.status(400).json({ error: 'Role is required.' })
    const normalizedImages = normalizeImageInput(images, 'portrait')
    const normalizedLinks = links === undefined ? profileLinksForSource(req.body, FASHION_TALENT_LEGACY_LINK_FIELDS) : normalizeProfileLinks(links)
    const legacyLinkFields = legacyFieldsFromProfileLinks(normalizedLinks, FASHION_TALENT_LEGACY_LINK_FIELDS)
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
        links: normalizedLinks,
        ...legacyLinkFields,
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
    const existing = await prisma.fashionCrew.findUnique({ where: { id }, select: selectCrewList() })
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
      await deleteRemovedBlobPathnames(
        [existing.pathname, existing.imageUrl],
        [pathname, imageUrl],
      )
      return res.status(200).json(withCrewImage(crew))
    }

    if (req.method === 'DELETE') {
      await prisma.$transaction(async (tx) => {
        await deleteFashionCreditsForPerson(tx, { crewId: id })
        await tx.fashionCrew.delete({ where: { id } })
      })
      await deleteUnusedBlobPathnames(collectBlobPathnames(existing.pathname, existing.imageUrl))
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
    collectionPlacements: {
      orderBy: { sortOrder: 'asc' },
      include: {
        collection: { select: { id: true, title: true, season: true, releaseDate: true } },
      },
    },
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
    releaseDate: true,
    order: true,
    creatorTalentId: true,
    collectionPlacements: {
      orderBy: { sortOrder: 'asc' },
      include: {
        collection: { select: { id: true, title: true, season: true, releaseDate: true } },
      },
    },
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
    effectiveReleaseDate: effectiveLookReleaseDate(look),
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
    effectiveReleaseDate: effectiveLookReleaseDate(look),
    images: clientImages(look.images ?? []),
    imageCount: look._count?.images ?? 0,
    pieceCount: look._count?.pieces ?? 0,
  }
}

function effectiveLookReleaseDate(look) {
  return look?.releaseDate ?? look?.collectionPlacements?.[0]?.collection?.releaseDate ?? null
}

function compareLooksForAdmin(left, right) {
  const leftRelease = left.effectiveReleaseDate ? new Date(left.effectiveReleaseDate).getTime() : null
  const rightRelease = right.effectiveReleaseDate ? new Date(right.effectiveReleaseDate).getTime() : null

  if (leftRelease !== null && rightRelease !== null && leftRelease !== rightRelease) return rightRelease - leftRelease
  if (leftRelease !== null) return -1
  if (rightRelease !== null) return 1

  const leftPlacement = lookPlacementSortKey(left)
  const rightPlacement = lookPlacementSortKey(right)
  const collectionCompare = leftPlacement.collectionName.localeCompare(rightPlacement.collectionName, undefined, { sensitivity: 'base', numeric: true })
  if (collectionCompare !== 0) return collectionCompare

  if (leftPlacement.sortOrder !== rightPlacement.sortOrder) return leftPlacement.sortOrder - rightPlacement.sortOrder

  return String(left.title ?? '').localeCompare(String(right.title ?? ''), undefined, { sensitivity: 'base', numeric: true })
}

function lookPlacementSortKey(look) {
  const placements = Array.isArray(look.collectionPlacements) ? look.collectionPlacements : []
  if (!placements.length) {
    return {
      collectionName: '\uffff',
      sortOrder: look.order ?? Number.MAX_SAFE_INTEGER,
    }
  }

  const [placement] = placements.toSorted((left, right) => {
    const collectionCompare = String(left.collection?.title ?? '').localeCompare(String(right.collection?.title ?? ''), undefined, { sensitivity: 'base', numeric: true })
    if (collectionCompare !== 0) return collectionCompare
    return (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
  })

  return {
    collectionName: String(placement.collection?.title ?? ''),
    sortOrder: placement.sortOrder ?? 0,
  }
}

function normalizeLookPlacements(body) {
  const rawPlacements = Array.isArray(body.collectionPlacements)
    ? body.collectionPlacements
    : (body.collectionId ? [{ collectionId: body.collectionId, sortOrder: body.order ?? 0 }] : [])
  const seen = new Set()

  return rawPlacements.reduce((placements, placement) => {
    const collectionId = placement?.collectionId || ''
    if (!collectionId || seen.has(collectionId)) return placements
    seen.add(collectionId)
    const sortOrder = Number(placement.sortOrder)
    placements.push({
      collectionId,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : placements.length,
    })
    return placements
  }, [])
}

// A TALENT session may only place a look into collections it created itself —
// checked by re-querying which of the requested collectionIds are actually owned
// by the caller, rather than trusting the client-submitted placement list.
async function validateLookCollectionOwnership(session, placements) {
  if (isSuperAdmin(session) || !placements.length) return true
  if (!isTalentAdmin(session)) return false

  const collectionIds = [...new Set(placements.map((placement) => placement.collectionId))]
  const ownedCollections = await prisma.fashionCollection.findMany({
    where: {
      id: { in: collectionIds },
      creatorTalentId: session.talentId,
    },
    select: { id: true },
  })

  return ownedCollections.length === collectionIds.length
}

function hasAnyFashionPage(session, pageKeys) {
  return pageKeys.some((pageKey) => canAccessAdminPage(session, pageKey))
}

function canAccessFashionResource(session, resource, method) {
  if (resource === 'talent') {
    if (method === 'GET') {
      return hasAnyFashionPage(session, [
        ADMIN_PAGE_KEYS.FASHION_TALENT,
        ADMIN_PAGE_KEYS.FASHION_COLLECTIONS,
        ADMIN_PAGE_KEYS.FASHION_LOOKS,
      ])
    }
    return canAccessAdminPage(session, ADMIN_PAGE_KEYS.FASHION_TALENT)
  }

  if (resource === 'crew') {
    if (method === 'GET') {
      return hasAnyFashionPage(session, [
        ADMIN_PAGE_KEYS.FASHION_OUTSIDE_TALENT,
        ADMIN_PAGE_KEYS.FASHION_COLLECTIONS,
        ADMIN_PAGE_KEYS.FASHION_LOOKS,
      ])
    }
    return canAccessAdminPage(session, ADMIN_PAGE_KEYS.FASHION_OUTSIDE_TALENT)
  }

  if (resource === 'looks') {
    return canAccessAdminPage(session, ADMIN_PAGE_KEYS.FASHION_LOOKS)
  }

  return false
}

// credits: [{ talentId?, crewId?, creditName, roleLabel }]
function creditsCreateManyData(credits) {
  const normalized = Array.isArray(credits) ? credits : []
  return normalized.reduce((data, credit) => {
    if (!credit?.talentId && !credit?.crewId && !credit?.creditName?.trim()) return data
    data.push({
      talentId: credit.talentId || null,
      crewId: credit.crewId || null,
      creditName: credit.creditName?.trim() ?? '',
      roleLabel: credit.roleLabel ?? '',
      sortOrder: data.length,
    })
    return data
  }, [])
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

// Auto-registers unlinked credit names as new FashionCrew rows: any credit that
// has neither talentId nor crewId but does have a free-text creditName is looked
// up by name against existing Talent/Crew, and if there's still no match, a new
// FashionCrew row is created for it. This is the "typing a name registers a
// person" business rule — there's no separate confirmation step.
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

  const newCrewEntries = []
  for (const [nameKey, entry] of namesByKey) {
    if (talentByName.has(nameKey) || crewByName.has(nameKey)) continue
    newCrewEntries.push({ nameKey, entry })
  }

  const createdCrew = await Promise.all(newCrewEntries.map(({ entry }) => (
    tx.fashionCrew.create({
      data: {
        name: entry.name,
        role: entry.role,
        externalUrl: '',
        imageUrl: '',
        pathname: null,
      },
      select: { id: true, name: true },
    })
  )))

  for (const created of createdCrew) {
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

async function handleLooks(req, res, session) {
  const { id } = req.query

  if (id) {
    const existing = await prisma.fashionLook.findFirst({
      where: { id, ...fashionProjectCreatorWhere(session) },
      select: {
        id: true,
        images: { select: { url: true, pathname: true } },
        pieces: { select: { imageUrl: true, pathname: true } },
      },
    })
    if (!existing) return res.status(404).json({ error: 'Look not found' })

    if (req.method === 'GET') {
      const look = await prisma.fashionLook.findFirst({
        where: { id, ...fashionProjectCreatorWhere(session) },
        include: includeLook(),
      })
      return res.status(200).json(withLookImages(look))
    }

    if (req.method === 'PUT') {
      const { title, slug, description, order, isVisible, releaseDate, images, pieces, credits } = req.body
      const placements = req.body.collectionPlacements !== undefined || req.body.collectionId !== undefined
        ? normalizeLookPlacements(req.body)
        : null
      if (placements && !(await validateLookCollectionOwnership(session, placements))) {
        return res.status(403).json({ error: 'You can only place looks in your own collections.' })
      }
      const normalizedImages = images === undefined ? null : normalizeImageInput(images, 'lookbook')
      const normalizedPieceImages = pieces === undefined
        ? null
        : (Array.isArray(pieces) ? pieces : [])
            .flatMap((piece) => {
              const normalizedImage = normalizeImageInput(piece?.image ? [piece.image] : [], 'piece')[0]
              return normalizedImage ? [normalizedImage] : []
            })

      // Replace child collections (pieces, piece credits, look credits) wholesale to keep
      // the form-driven CMS simple, matching the same pattern used for Album/Artist image
      // collections. Done as one interactive transaction so a failed update can't strand
      // the Look with its children deleted but not replaced.
      const look = await prisma.$transaction(async (tx) => {
        const shouldReplaceCredits = credits !== undefined
        const shouldReplacePieces = pieces !== undefined
        const shouldReplacePlacements = placements !== null
        const resolved = await resolveTypedOutsideTalentCredits(
          tx,
          shouldReplaceCredits ? credits : undefined,
          shouldReplacePieces ? pieces : undefined,
        )
        const lookCredits = shouldReplaceCredits ? creditsCreateManyData(resolved.credits) : []
        const lookPieces = shouldReplacePieces ? piecesCreateData(resolved.pieces) : []

        if (shouldReplacePieces) {
          await tx.fashionPieceCredit.deleteMany({ where: { piece: { lookId: id } } })
          await tx.fashionPiece.deleteMany({ where: { lookId: id } })
        }
        if (shouldReplaceCredits) {
          await tx.fashionLookCredit.deleteMany({ where: { lookId: id } })
        }

        return tx.fashionLook.update({
          where: { id },
          data: {
            title,
            slug: slug !== undefined ? (slug || slugify(title)) : undefined,
            description: description !== undefined ? description ?? '' : undefined,
            order,
            isVisible,
            releaseDate: releaseDate !== undefined ? (releaseDate ? new Date(releaseDate) : null) : undefined,
            collectionPlacements: shouldReplacePlacements
              ? {
                  deleteMany: {},
                  ...(placements.length ? { createMany: { data: placements } } : {}),
                }
              : undefined,
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
      if (normalizedImages !== null) {
        await deleteRemovedBlobPathnames(existing.images, normalizedImages)
      }
      if (normalizedPieceImages !== null) {
        await deleteRemovedBlobPathnames(
          existing.pieces.map((piece) => [piece.pathname, piece.imageUrl]),
          normalizedPieceImages,
        )
      }
      return res.status(200).json(withLookImages(look))
    }

    if (req.method === 'DELETE') {
      const blobPathnames = collectBlobPathnames(
        existing.images,
        existing.pieces.map((piece) => [piece.pathname, piece.imageUrl]),
      )
      await prisma.fashionLook.delete({ where: { id } })
      await deleteUnusedBlobPathnames(blobPathnames)
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method === 'GET') {
    const looks = await prisma.fashionLook.findMany({
      where: fashionProjectCreatorWhere(session),
      orderBy: [{ order: 'asc' }, { title: 'asc' }],
      select: selectLookList(),
    })
    return res.status(200).json(looks.map(withLookListImages).sort(compareLooksForAdmin))
  }

  if (req.method === 'POST') {
    const { title, slug, description, order, isVisible, releaseDate, images, pieces, credits } = req.body
    if (!title) return res.status(400).json({ error: 'Title is required.' })
    const placements = normalizeLookPlacements(req.body)
    if (!(await validateLookCollectionOwnership(session, placements))) {
      return res.status(403).json({ error: 'You can only place looks in your own collections.' })
    }
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
          releaseDate: releaseDate ? new Date(releaseDate) : null,
          creatorTalentId: isTalentAdmin(session) ? session.talentId : null,
          collectionPlacements: placements.length
            ? { createMany: { data: placements } }
            : undefined,
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

/** Dispatches to the talent/crew/looks sub-handler based on `?resource=`, after the shared per-resource permission check. */
export default async function handler(req, res) {
  const session = requireAdmin(req, res)
  if (!session) return

  const resource = req.query.resource
  if (!canAccessFashionResource(session, resource, req.method)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (resource === 'talent') return handleTalent(req, res, session)
  if (resource === 'looks') return handleLooks(req, res, session)
  if (resource === 'crew') return handleCrew(req, res)

  return res.status(400).json({ error: 'Unknown fashion resource' })
}
