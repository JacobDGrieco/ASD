import jwt from 'jsonwebtoken'

export const ADMIN_ROLE_SUPER = 'SUPER_ADMIN'
export const ADMIN_ROLE_ARTIST = 'ARTIST'
export const ADMIN_ROLE_VIEWER = 'VIEWER'
const VIEWER_TIME_ZONE = 'America/New_York'

function secret() {
  return process.env.JWT_SECRET
}

export function signToken(session) {
  return jwt.sign(
    {
      role: session.role,
      artistId: session.artistId ?? null,
      artistSlug: session.artistSlug ?? null,
      artistName: session.artistName ?? null,
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
      }
    }

    return {
      role: payload.role,
      artistId: payload.artistId ?? null,
      artistSlug: payload.artistSlug ?? null,
      artistName: payload.artistName ?? null,
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

export function isViewer(session) {
  return session?.role === ADMIN_ROLE_VIEWER
}

export function requireAdmin(req, res) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }

  const session = verifyToken(auth.slice(7))
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
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIEWER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const [year, month, day] = formatter.format(new Date()).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1))
}

export function viewerAlbumVisibilityWhere() {
  return {
    releaseDate: {
      lt: viewerReleaseDateUpperBound(),
    },
  }
}

export function viewerSongVisibilityWhere() {
  const upperBound = viewerReleaseDateUpperBound()

  return {
    AND: [
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
  return { artistId: session.artistId }
}

export function artistScopedSongWhere(session) {
  if (isSuperAdmin(session)) return {}
  if (isViewer(session)) return viewerSongVisibilityWhere()

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
