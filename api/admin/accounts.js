import { prisma } from '../../src/lib/prisma.js'
import { requireSuperAdmin } from '../../src/lib/auth.js'
import { hashPassword } from '../../src/lib/passwords.js'
import { validateUniqueArtistPassword } from '../../src/lib/adminAccounts.js'

function formatAccount(account) {
  return {
    id: account.id,
    artistId: account.artistId,
    active: account.active,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    artist: account.artist,
  }
}

export default async function handler(req, res) {
  const session = requireSuperAdmin(req, res)
  if (!session) return

  const { id } = req.query

  if (req.method === 'GET') {
    const artists = await prisma.artist.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: {
        adminAccess: true,
      },
    })

    return res.status(200).json(
      artists.map((artist) => ({
        artist: {
          id: artist.id,
          name: artist.name,
          slug: artist.slug,
        },
        account: artist.adminAccess ? formatAccount({ ...artist.adminAccess, artist: undefined }) : null,
        hasAccount: Boolean(artist.adminAccess),
      }))
    )
  }

  if (req.method === 'POST') {
    const { artistId, password, active } = req.body ?? {}
    if (!artistId) return res.status(400).json({ error: 'Artist is required.' })
    if (!password) return res.status(400).json({ error: 'Password is required.' })

    const existingAccount = await prisma.artistAdminAccess.findUnique({ where: { artistId } })
    if (existingAccount) return res.status(400).json({ error: 'That artist already has an account.' })

    const passwordError = await validateUniqueArtistPassword(password, artistId)
    if (passwordError) return res.status(400).json({ error: passwordError })

    const account = await prisma.artistAdminAccess.create({
      data: {
        artistId,
        passwordHash: hashPassword(password),
        active: active ?? true,
      },
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    return res.status(201).json(formatAccount(account))
  }

  if (!id) return res.status(400).json({ error: 'Account id is required.' })

  const existing = await prisma.artistAdminAccess.findUnique({
    where: { id },
    include: {
      artist: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })
  if (!existing) return res.status(404).json({ error: 'Account not found.' })

  if (req.method === 'PUT') {
    const { password, active } = req.body ?? {}
    if (typeof active !== 'boolean' && !password) {
      return res.status(400).json({ error: 'Nothing to update.' })
    }

    const passwordError = password ? await validateUniqueArtistPassword(password, existing.artistId) : null
    if (passwordError) return res.status(400).json({ error: passwordError })

    const account = await prisma.artistAdminAccess.update({
      where: { id },
      data: {
        active: typeof active === 'boolean' ? active : undefined,
        passwordHash: password ? hashPassword(password) : undefined,
      },
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    return res.status(200).json(formatAccount(account))
  }

  if (req.method === 'DELETE') {
    await prisma.artistAdminAccess.delete({ where: { id } })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
