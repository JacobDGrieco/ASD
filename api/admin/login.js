import { prisma } from '../../src/lib/prisma.js'
import { ADMIN_ROLE_ARTIST, ADMIN_ROLE_SUPER, ADMIN_ROLE_TALENT, ADMIN_ROLE_VIEWER, requireAdmin, serializeAdminAuthCookie, serializeClearAdminAuthCookie, signToken } from '../../src/lib/auth.js'
import { getAdminAccountSchemaCapabilities } from '../../src/lib/adminAccountSchema.js'
import { normalizeAdminPageAccess } from '../../src/lib/adminPageAccess.js'
import { verifyPassword } from '../../src/lib/passwords.js'
import { isAsdRecordsArtist } from '../../src/lib/publicVisibility.js'

function createSuperAdminSession(accountName = null) {
  return {
    role: ADMIN_ROLE_SUPER,
    artistId: null,
    artistSlug: null,
    artistName: null,
    talentId: null,
    talentSlug: null,
    talentName: null,
    accountName,
    pageAccess: [],
  }
}

function createArtistSession(access) {
  return {
    role: ADMIN_ROLE_ARTIST,
    artistId: access.artist.id,
    artistSlug: access.artist.slug,
    artistName: access.artist.name,
    talentId: null,
    talentSlug: null,
    talentName: null,
    accountName: access.name || access.artist.name,
    pageAccess: normalizeAdminPageAccess(access.pageAccess),
  }
}

function createTalentSession(access) {
  return {
    role: ADMIN_ROLE_TALENT,
    artistId: null,
    artistSlug: null,
    artistName: null,
    talentId: access.talent.id,
    talentSlug: access.talent.slug,
    talentName: access.talent.name,
    accountName: access.name || access.talent.name,
    pageAccess: normalizeAdminPageAccess(access.pageAccess),
  }
}

function createViewerSession() {
  return {
    role: ADMIN_ROLE_VIEWER,
    artistId: null,
    artistSlug: null,
    artistName: null,
  }
}

function sendLogin(res, session) {
  const token = signToken(session)
  res.setHeader('Set-Cookie', serializeAdminAuthCookie(token))
  return res.status(200).json({ session })
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = requireAdmin(req, res)
    if (!session) return
    return res.status(200).json({ session })
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', serializeClearAdminAuthCookie())
    return res.status(200).json({ ok: true })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { password } = req.body ?? {}
  if (!password) return res.status(401).json({ error: 'Invalid password' })

  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    const session = createSuperAdminSession()
    return sendLogin(res, session)
  }

  if (password === 'viewer') {
    const session = createViewerSession()
    return sendLogin(res, session)
  }

  const capabilities = await getAdminAccountSchemaCapabilities(prisma)
  const artistAccessList = await prisma.artistAdminAccess.findMany({
    where: { active: true },
    select: {
      id: true,
      passwordHash: true,
      active: true,
      ...(capabilities.hasArtistAccountName ? { name: true } : {}),
      ...(capabilities.hasArtistAccountPageAccess ? { pageAccess: true } : {}),
      artist: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  })

  const match = artistAccessList.find((access) => verifyPassword(password, access.passwordHash))
  if (match) {
    if (isAsdRecordsArtist(match.artist)) {
      return sendLogin(res, createSuperAdminSession(match.name || match.artist.name))
    }

    return sendLogin(res, createArtistSession(match))
  }

  if (!capabilities.hasFashionTalentAdminAccess) {
    return res.status(401).json({ error: 'Invalid password' })
  }

  const talentAccessList = await prisma.fashionTalentAdminAccess.findMany({
    where: { active: true },
    include: {
      talent: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  })

  const talentMatch = talentAccessList.find((access) => verifyPassword(password, access.passwordHash))
  if (talentMatch) return sendLogin(res, createTalentSession(talentMatch))

  return res.status(401).json({ error: 'Invalid password' })
}
