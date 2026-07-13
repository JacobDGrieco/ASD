import { prisma } from '../../src/lib/prisma.js'
import { requireSuperAdmin } from '../../src/lib/auth.js'
import { buildClientImageUrl, normalizeImageInput } from '../../src/lib/images.js'

const PROFILE_ID = 'main'
const DEFAULT_COMPANY_BIO = 'ASD Records is a music label, fashion vertical, and creative operations company for artists who move outside the expected lane. The company pairs releases, visuals, editorial work, and live-facing media into one connected platform.'

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
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

async function getProfile() {
  return prisma.companyProfile.upsert({
    where: { id: PROFILE_ID },
    update: {},
    create: { id: PROFILE_ID, bio: DEFAULT_COMPANY_BIO },
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
      bio: profile.bio,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
    members: members.map(formatMember),
  }
}

function validateProfile(body) {
  const bio = normalizeString(body?.bio)
  if (!bio) return { error: 'Company bio is required.' }
  return { bio }
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
      update: { bio: validation.bio },
      create: { id: PROFILE_ID, bio: validation.bio },
    })

    return res.status(200).json({
      id: profile.id,
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

    return res.status(200).json(formatMember(member))
  }

  if (req.method === 'DELETE') {
    await prisma.companyMember.delete({ where: { id } })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
