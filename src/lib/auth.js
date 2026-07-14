import jwt from 'jsonwebtoken'
import { releaseVisibilityUpperBound } from './releaseSchedule.js'
import { hasAdminPageAccess, normalizeAdminPageAccess } from './adminPageAccess.js'

export const ADMIN_ROLE_SUPER = 'SUPER_ADMIN'
export const ADMIN_ROLE_ARTIST = 'ARTIST'
export const ADMIN_ROLE_TALENT = 'TALENT'
export const ADMIN_ROLE_VIEWER = 'VIEWER'
export const ADMIN_AUTH_COOKIE_NAME = 'asd_admin_token'

function secret() {
  return process.env.JWT_SECRET
}

function isUsableBearerToken(value) {
  return Boolean(value && value !== 'null' && value !== 'undefined' && value !== 'cookie')
}

function parseCookieHeader(cookieHeader = '') {
  return cookieHeader.split(';').reduce((cookies, part) => {
    const separatorIndex = part.indexOf('=')
    if (separatorIndex === -1) return cookies
    const key = part.slice(0, separatorIndex).trim()
    const value = part.slice(separatorIndex + 1).trim()
    if (key) cookies[key] = decodeURIComponent(value)
    return cookies
  }, {})
}

export function serializeAdminAuthCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${ADMIN_AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${8 * 60 * 60}${secure}`
}

export function serializeClearAdminAuthCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${ADMIN_AUTH_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`
}

export function readAdminTokenFromRequest(req) {
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) {
    const bearerToken = auth.slice(7)
    if (isUsableBearerToken(bearerToken)) return bearerToken
  }

  return parseCookieHeader(req.headers.cookie)[ADMIN_AUTH_COOKIE_NAME] ?? null
}

export function signToken(session) {
  return jwt.sign(
    {
      role: session.role,
      artistId: session.artistId ?? null,
      artistSlug: session.artistSlug ?? null,
      artistName: session.artistName ?? null,
      talentId: session.talentId ?? null,
      talentSlug: session.talentSlug ?? null,
      talentName: session.talentName ?? null,
      accountName: session.accountName ?? null,
      pageAccess: normalizeAdminPageAccess(session.pageAccess),
    },
    secret(),
    { expiresIn: '8h' }
  )
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, secret())
    if (payload?.admin === true && !payload?.role) {
      return {
        role: ADMIN_ROLE_SUPER,
        artistId: null,
        artistSlug: null,
        artistName: null,
        talentId: null,
        talentSlug: null,
        talentName: null,
        accountName: null,
        pageAccess: [],
      }
    }

    return {
      role: payload.role,
      artistId: payload.artistId ?? null,
      artistSlug: payload.artistSlug ?? null,
      artistName: payload.artistName ?? null,
      talentId: payload.talentId ?? null,
      talentSlug: payload.talentSlug ?? null,
      talentName: payload.talentName ?? null,
      accountName: payload.accountName ?? null,
      pageAccess: normalizeAdminPageAccess(payload.pageAccess),
    }
  } catch {
    return null
  }
}

export function isSuperAdmin(session) {
  return session?.role === ADMIN_ROLE_SUPER
}

export function isArtistAdmin(session) {
  return session?.role === ADMIN_ROLE_ARTIST && Boolean(session.artistId)
}

export function isTalentAdmin(session) {
  return session?.role === ADMIN_ROLE_TALENT && Boolean(session.talentId)
}

export function isViewer(session) {
  return session?.role === ADMIN_ROLE_VIEWER
}

export function canAccessAdminPage(session, pageKey) {
  return hasAdminPageAccess(session, pageKey)
}

export function requireAdmin(req, res) {
  const token = readAdminTokenFromRequest(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }

  const session = verifyToken(token)
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }

  return session
}

export function requireSuperAdmin(req, res) {
  const session = requireAdmin(req, res)
  if (!session) return null
  if (!isSuperAdmin(session)) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  return session
}

export function canAccessArtist(session, artistId) {
  return isSuperAdmin(session) || (isArtistAdmin(session) && session.artistId === artistId)
}

function viewerReleaseDateUpperBound() {
  return releaseVisibilityUpperBound()
}

export function viewerAlbumVisibilityWhere() {
  const upperBound = viewerReleaseDateUpperBound()

  return {
    AND: [
      {
        OR: [
          { isVisible: true },
          {
            AND: [
              { isVisible: false },
              { autoShowOnRelease: true },
              { releaseDate: { lt: upperBound } },
            ],
          },
        ],
      },
      {
        releaseDate: {
          lt: upperBound,
        },
      },
    ],
  }
}

export function viewerSongVisibilityWhere() {
  const upperBound = viewerReleaseDateUpperBound()

  return {
    AND: [
      {
        OR: [
          { isVisible: true },
          {
            AND: [
              { isVisible: false },
              { autoShowOnRelease: true },
              {
                OR: [
                  { meta: { is: { releaseDate: { lt: upperBound } } } },
                  {
                    placements: {
                      some: {
                        album: {
                          releaseDate: { lt: upperBound },
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        OR: [
          { meta: { is: null } },
          { meta: { is: { releaseDate: null } } },
          { meta: { is: { releaseDate: { lt: upperBound } } } },
        ],
      },
      {
        placements: {
          none: {
            album: {
              releaseDate: {
                gte: upperBound,
              },
            },
          },
        },
      },
    ],
  }
}

export function artistScopedAlbumWhere(session) {
  if (isSuperAdmin(session)) return {}
  if (isViewer(session)) return viewerAlbumVisibilityWhere()
  if (!isArtistAdmin(session)) return { id: '__no_access__' }
  return { artistId: session.artistId }
}

export function artistScopedSongWhere(session) {
  if (isSuperAdmin(session)) return {}
  if (isViewer(session)) return viewerSongVisibilityWhere()
  if (!isArtistAdmin(session)) return { id: '__no_access__' }

  return {
    AND: [
      {
        placements: {
          some: {
            album: {
              artistId: session.artistId,
            },
          },
        },
      },
      {
        placements: {
          none: {
            album: {
              artistId: {
                not: session.artistId,
              },
            },
          },
        },
      },
    ],
  }
}
