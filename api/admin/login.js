import { prisma } from '../../src/lib/prisma.js'
import { ADMIN_ROLE_ARTIST, ADMIN_ROLE_SUPER, ADMIN_ROLE_VIEWER, signToken } from '../../src/lib/auth.js'
import { verifyPassword } from '../../src/lib/passwords.js'

function createSuperAdminSession() {
  return {
    role: ADMIN_ROLE_SUPER,
    artistId: null,
    artistSlug: null,
    artistName: null,
  }
}

function createArtistSession(access) {
  return {
    role: ADMIN_ROLE_ARTIST,
    artistId: access.artist.id,
    artistSlug: access.artist.slug,
    artistName: access.artist.name,
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { password } = req.body ?? {}
  if (!password) return res.status(401).json({ error: 'Invalid password' })

  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    const session = createSuperAdminSession()
    return res.status(200).json({ token: signToken(session), session })
  }

  if (password === 'viewer') {
    const session = createViewerSession()
    return res.status(200).json({ token: signToken(session), session })
  }

  const artistAccessList = await prisma.artistAdminAccess.findMany({
    where: { active: true },
    include: {
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
  if (!match) {
    return res.status(401).json({ error: 'Invalid password' })
  }

  const session = createArtistSession(match)
  return res.status(200).json({ token: signToken(session), session })
}
