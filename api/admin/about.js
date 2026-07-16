/**
 * Admin CRUD for the "About" page: the singleton `CompanyProfile` (hero title/bio)
 * and the `CompanyMember` list (leadership bios). SUPER_ADMIN only.
 *
 * Routes: `GET` (profile + members), `PUT` with no `id` (update the hero profile),
 * `POST` (create a member), `PUT`/`DELETE` with `id` (update/delete a member).
 * Server-only (Vercel Function). Consumed by `AdminAboutPage.jsx`.
 */
import { prisma } from '../../src/lib/prisma.js'
import { requireSuperAdmin } from '../../src/lib/auth.js'
import { collectBlobPathnames, deleteRemovedBlobPathnames, deleteUnusedBlobPathnames } from '../../src/lib/blobCleanup.js'
import { buildClientImageUrl, normalizeImageInput } from '../../src/lib/images.js'
import { COMPANY_SUMMARY } from '../../src/lib/companyProfile.js'

const PROFILE_ID = 'main'
const DEFAULT_COMPANY_TITLE = COMPANY_SUMMARY.title
const DEFAULT_COMPANY_BIO = COMPANY_SUMMARY.description

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeMultilineTitle(value) {
  return normalizeString(value).replace(/\\n/g, '\n')
}

function normalizeMemberImage(image) {
  return normalizeImageInput(image ? [image] : [], 'portrait')[0] ?? null
}

function formatMember(member) {
  const image = member.imageUrl
    ? {
        id: `${member.id}-image`,
        url: member.imageUrl,
        pathname: member.imagePathname,
        usage: 'portrait',
        altText: member.name,
        sortOrder: 0,
        isPrimary: true,
        previewUrl: buildClientImageUrl({ url: member.imageUrl, pathname: member.imagePathname }),
      }
    : null

  return {
    id: member.id,
    name: member.name,
    role: member.role,
    bio: member.bio,
    imageUrl: image?.previewUrl ?? '',
    image,
    isVisible: member.isVisible,
    sortOrder: member.sortOrder,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  }
}

// The CompanyProfile row is a singleton keyed by a fixed id — upsert so the first
// request after a fresh deploy creates it with sane defaults instead of 404ing.
async function getProfile() {
  return prisma.companyProfile.upsert({
    where: { id: PROFILE_ID },
    update: {},
    create: {
      id: PROFILE_ID,
      title: DEFAULT_COMPANY_TITLE,
      bio: DEFAULT_COMPANY_BIO,
    },
  })
}

async function getAboutPayload() {
  const [profile, members] = await Promise.all([
    getProfile(),
    prisma.companyMember.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
  ])

  return {
    profile: {
      id: profile.id,
      title: profile.title || DEFAULT_COMPANY_TITLE,
      bio: profile.bio,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
    members: members.map(formatMember),
  }
}

function validateProfile(body) {
  const title = normalizeMultilineTitle(body?.title)
  const bio = normalizeString(body?.bio)
  if (!title) return { error: 'About hero title is required.' }
  if (!bio) return { error: 'About hero bio is required.' }
  return { title, bio }
}

function validateMember(body) {
  const name = normalizeString(body?.name)
  const role = normalizeString(body?.role)
  const bio = normalizeString(body?.bio)
  const image = normalizeMemberImage(body?.image)
  const sortOrder = Number(body?.sortOrder ?? 0)

  if (!name) return { error: 'Name is required.' }
  if (!role) return { error: 'Role is required.' }
  if (!bio) return { error: 'Bio is required.' }
  if (!image?.url) return { error: 'Image is required.' }

  return {
    name,
    role,
    bio,
    imageUrl: image.url,
    imagePathname: image.pathname,
    isVisible: body?.isVisible !== false,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
  }
}

export default async function handler(req, res) {
  const session = requireSuperAdmin(req, res)
  if (!session) return

  const id = typeof req.query.id === 'string' ? req.query.id : ''

  if (req.method === 'GET') {
    return res.status(200).json(await getAboutPayload())
  }

  if (req.method === 'PUT' && !id) {
    const validation = validateProfile(req.body ?? {})
    if (validation.error) return res.status(400).json({ error: validation.error })

    const profile = await prisma.companyProfile.upsert({
      where: { id: PROFILE_ID },
      update: {
        title: validation.title,
        bio: validation.bio,
      },
      create: {
        id: PROFILE_ID,
        title: validation.title,
        bio: validation.bio,
      },
    })

    return res.status(200).json({
      id: profile.id,
      title: profile.title,
      bio: profile.bio,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    })
  }

  if (req.method === 'POST') {
    const validation = validateMember(req.body ?? {})
    if (validation.error) return res.status(400).json({ error: validation.error })

    const member = await prisma.companyMember.create({
      data: validation,
    })

    return res.status(201).json(formatMember(member))
  }

  if (!id) return res.status(400).json({ error: 'Member id is required.' })

  const existing = await prisma.companyMember.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Member not found.' })

  if (req.method === 'PUT') {
    const validation = validateMember(req.body ?? {})
    if (validation.error) return res.status(400).json({ error: validation.error })

    const member = await prisma.companyMember.update({
      where: { id },
      data: validation,
    })

    await deleteRemovedBlobPathnames(
      [existing.imagePathname, existing.imageUrl],
      [validation.imagePathname, validation.imageUrl],
    )
    return res.status(200).json(formatMember(member))
  }

  if (req.method === 'DELETE') {
    const blobPathnames = collectBlobPathnames(existing.imagePathname, existing.imageUrl)
    await prisma.companyMember.delete({ where: { id } })
    await deleteUnusedBlobPathnames(blobPathnames)
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
