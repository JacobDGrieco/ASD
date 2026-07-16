/**
 * Admin CRUD for login accounts (`ArtistAdminAccess`/`FashionTalentAdminAccess`) —
 * i.e. who besides the global `ADMIN_PASSWORD` super admin can log into the CMS,
 * and which pages/permissions each account has. SUPER_ADMIN only.
 *
 * GET returns one row per Artist/FashionTalent (whether or not it has an account
 * yet) so the accounts page can show "no account" rows alongside real ones. Every
 * write path re-validates password uniqueness across accounts and against the
 * global admin password (`validateUniqueAccountPassword`) and normalizes
 * `pageAccess` to a default set when the caller doesn't specify one.
 *
 * Server-only (Vercel Function). Consumed by `AdminAccountsPage.jsx`.
 */
import { prisma } from '../../src/lib/prisma.js'
import { requireSuperAdmin } from '../../src/lib/auth.js'
import { getAdminAccountSchemaCapabilities } from '../../src/lib/adminAccountSchema.js'
import { hashPassword } from '../../src/lib/passwords.js'
import { validateUniqueAccountPassword } from '../../src/lib/adminAccounts.js'
import {
  ADMIN_ACCOUNT_TYPES,
  getDefaultAdminPageAccess,
  normalizeAdminPageAccess,
} from '../../src/lib/adminPageAccess.js'
import { isAsdRecordsArtist } from '../../src/lib/publicVisibility.js'

function formatSubject(subject) {
  return {
    id: subject.id,
    name: subject.name,
    slug: subject.slug,
  }
}

function formatAccount(account, accountType) {
  const subjectId = accountType === ADMIN_ACCOUNT_TYPES.FASHION_TALENT ? account.talentId : account.artistId

  return {
    id: account.id,
    accountType,
    subjectId,
    name: account.name ?? '',
    active: account.active,
    pageAccess: normalizeAdminPageAccess(account.pageAccess),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }
}

// The `name`/`pageAccess` columns on ArtistAdminAccess were added in a later
// migration than the model itself — only select/write them when the connected
// database actually has them (see adminAccountSchema.js), so this endpoint keeps
// working against a DB that hasn't been migrated yet.
function artistAdminAccessSelect(capabilities) {
  return {
    id: true,
    artistId: true,
    active: true,
    createdAt: true,
    updatedAt: true,
    ...(capabilities.hasArtistAccountName ? { name: true } : {}),
    ...(capabilities.hasArtistAccountPageAccess ? { pageAccess: true } : {}),
  }
}

function artistAdminAccessData(data, capabilities) {
  return {
    artistId: data.artistId,
    passwordHash: data.passwordHash,
    active: data.active,
    ...(capabilities.hasArtistAccountName ? { name: data.name } : {}),
    ...(capabilities.hasArtistAccountPageAccess ? { pageAccess: data.pageAccess } : {}),
  }
}

function artistAdminAccessUpdateData(data, capabilities) {
  return {
    passwordHash: data.passwordHash,
    active: data.active,
    ...(capabilities.hasArtistAccountName ? { name: data.name } : {}),
    ...(capabilities.hasArtistAccountPageAccess ? { pageAccess: data.pageAccess } : {}),
  }
}

// The reserved "A.S.D." label artist's account is really a super-admin login in
// disguise (see isAsdRecordsArtist / login.js) — flag it so the UI can label it
// "Admin" instead of "Music Artist" and sort it to the top.
function formatRow(subject, account, accountType) {
  const isSuperAdminAccount = accountType === ADMIN_ACCOUNT_TYPES.MUSIC_ARTIST && isAsdRecordsArtist(subject)

  return {
    rowId: `${accountType}:${subject.id}`,
    accountType,
    isSuperAdminAccount,
    subject: formatSubject(subject),
    account: account ? { ...formatAccount(account, accountType), isSuperAdminAccount } : null,
    hasAccount: Boolean(account),
  }
}

function normalizedAccessForSave(value, accountType) {
  const access = normalizeAdminPageAccess(value)
  return access.length > 0 ? access : getDefaultAdminPageAccess(accountType)
}

async function findAccountById(id, capabilities) {
  const artistAccess = await prisma.artistAdminAccess.findUnique({
    where: { id },
    select: {
      ...artistAdminAccessSelect(capabilities),
      artist: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  if (artistAccess) {
    return {
      account: artistAccess,
      accountType: ADMIN_ACCOUNT_TYPES.MUSIC_ARTIST,
      subject: artistAccess.artist,
      currentPasswordScope: { artistId: artistAccess.artistId },
    }
  }

  if (!capabilities.hasFashionTalentAdminAccess) return null

  const talentAccess = await prisma.fashionTalentAdminAccess.findUnique({
    where: { id },
    include: {
      talent: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  if (talentAccess) {
    return {
      account: talentAccess,
      accountType: ADMIN_ACCOUNT_TYPES.FASHION_TALENT,
      subject: talentAccess.talent,
      currentPasswordScope: { talentId: talentAccess.talentId },
    }
  }

  return null
}

export default async function handler(req, res) {
  const session = requireSuperAdmin(req, res)
  if (!session) return

  const { id } = req.query
  const capabilities = await getAdminAccountSchemaCapabilities(prisma)

  if (req.method === 'GET') {
    const [artists, talent] = await Promise.all([
      prisma.artist.findMany({
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          adminAccess: {
            select: artistAdminAccessSelect(capabilities),
          },
        },
      }),
      prisma.fashionTalent.findMany({
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          ...(capabilities.hasFashionTalentAdminAccess
            ? {
                adminAccess: true,
              }
            : {}),
        }
      }),
    ])

    const rows = [
      ...artists.map((artist) => formatRow(artist, artist.adminAccess, ADMIN_ACCOUNT_TYPES.MUSIC_ARTIST)),
      ...talent.map((person) => formatRow(person, person.adminAccess, ADMIN_ACCOUNT_TYPES.FASHION_TALENT)),
    ]

    return res.status(200).json(rows.sort((left, right) => {
      if (left.isSuperAdminAccount !== right.isSuperAdminAccount) return left.isSuperAdminAccount ? -1 : 1
      return left.subject.name.localeCompare(right.subject.name, undefined, { sensitivity: 'base', numeric: true })
    }))
  }

  if (req.method === 'POST') {
    const {
      accountType = ADMIN_ACCOUNT_TYPES.MUSIC_ARTIST,
      subjectId,
      name = '',
      password,
      active,
      pageAccess,
    } = req.body ?? {}

    if (!Object.values(ADMIN_ACCOUNT_TYPES).includes(accountType)) {
      return res.status(400).json({ error: 'Account type is invalid.' })
    }
    if (!subjectId) return res.status(400).json({ error: 'Person is required.' })
    if (!password) return res.status(400).json({ error: 'Password is required.' })

    if (accountType === ADMIN_ACCOUNT_TYPES.FASHION_TALENT) {
      if (!capabilities.hasFashionTalentAdminAccess) {
        return res.status(409).json({ error: 'Run the latest database migration before creating fashion talent accounts.' })
      }

      const existingAccount = await prisma.fashionTalentAdminAccess.findUnique({ where: { talentId: subjectId } })
      if (existingAccount) return res.status(400).json({ error: 'That fashion talent already has an account.' })

      const passwordError = await validateUniqueAccountPassword(password, { talentId: subjectId })
      if (passwordError) return res.status(400).json({ error: passwordError })

      const account = await prisma.fashionTalentAdminAccess.create({
        data: {
          talentId: subjectId,
          name,
          passwordHash: hashPassword(password),
          active: active ?? true,
          pageAccess: normalizedAccessForSave(pageAccess, accountType),
        },
        include: {
          talent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })

      return res.status(201).json({
        ...formatAccount(account, accountType),
        subject: formatSubject(account.talent),
      })
    }

    const existingAccount = await prisma.artistAdminAccess.findUnique({ where: { artistId: subjectId }, select: { id: true } })
    if (existingAccount) return res.status(400).json({ error: 'That music artist already has an account.' })

    const passwordError = await validateUniqueAccountPassword(password, { artistId: subjectId })
    if (passwordError) return res.status(400).json({ error: passwordError })

    const account = await prisma.artistAdminAccess.create({
      data: artistAdminAccessData({
        artistId: subjectId,
        name,
        passwordHash: hashPassword(password),
        active: active ?? true,
        pageAccess: normalizedAccessForSave(pageAccess, accountType),
      }, capabilities),
      select: {
        ...artistAdminAccessSelect(capabilities),
        artist: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    return res.status(201).json({
      ...formatAccount(account, accountType),
      isSuperAdminAccount: isAsdRecordsArtist(account.artist),
      subject: formatSubject(account.artist),
    })
  }

  if (!id) return res.status(400).json({ error: 'Account id is required.' })

  const existing = await findAccountById(id, capabilities)
  if (!existing) return res.status(404).json({ error: 'Account not found.' })

  if (req.method === 'PUT') {
    const { name, password, active, pageAccess } = req.body ?? {}
    if (
      typeof name !== 'string' &&
      typeof active !== 'boolean' &&
      !password &&
      pageAccess === undefined
    ) {
      return res.status(400).json({ error: 'Nothing to update.' })
    }

    const passwordError = password ? await validateUniqueAccountPassword(password, existing.currentPasswordScope) : null
    if (passwordError) return res.status(400).json({ error: passwordError })

    const data = {
      name: typeof name === 'string' ? name : undefined,
      active: typeof active === 'boolean' ? active : undefined,
      passwordHash: password ? hashPassword(password) : undefined,
      pageAccess: pageAccess === undefined ? undefined : normalizedAccessForSave(pageAccess, existing.accountType),
    }

    if (existing.accountType === ADMIN_ACCOUNT_TYPES.FASHION_TALENT) {
      const account = await prisma.fashionTalentAdminAccess.update({
        where: { id },
        data,
        include: {
          talent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })

      return res.status(200).json({
        ...formatAccount(account, existing.accountType),
        subject: formatSubject(account.talent),
      })
    }

    const account = await prisma.artistAdminAccess.update({
      where: { id },
      data: artistAdminAccessUpdateData(data, capabilities),
      select: {
        ...artistAdminAccessSelect(capabilities),
        artist: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    return res.status(200).json({
      ...formatAccount(account, existing.accountType),
      isSuperAdminAccount: isAsdRecordsArtist(account.artist),
      subject: formatSubject(account.artist),
    })
  }

  if (req.method === 'DELETE') {
    if (existing.accountType === ADMIN_ACCOUNT_TYPES.FASHION_TALENT) {
      await prisma.fashionTalentAdminAccess.delete({ where: { id } })
    } else {
      await prisma.artistAdminAccess.delete({ where: { id } })
    }
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
