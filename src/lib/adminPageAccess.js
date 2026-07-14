export const ADMIN_PAGE_KEYS = {
  BOARD: 'board',
  MUSIC_ARTISTS: 'music_artists',
  MUSIC_OUTSIDE_ARTISTS: 'music_outside_artists',
  MUSIC_ALBUMS: 'music_albums',
  MUSIC_SONGS: 'music_songs',
  MUSIC_RECORD_PLAYER: 'music_record_player',
  MUSIC_CROSSHAIR: 'music_crosshair',
  FASHION_TALENT: 'fashion_talent',
  FASHION_OUTSIDE_TALENT: 'fashion_outside_talent',
  FASHION_COLLECTIONS: 'fashion_collections',
  FASHION_LOOKS: 'fashion_looks',
}

export const ADMIN_ACCOUNT_TYPES = {
  MUSIC_ARTIST: 'MUSIC_ARTIST',
  FASHION_TALENT: 'FASHION_TALENT',
}

export const ADMIN_PAGE_GROUPS = [
  {
    key: 'board',
    label: 'The Board',
    pages: [
      { key: ADMIN_PAGE_KEYS.BOARD, label: 'Posts' },
    ],
  },
  {
    key: 'music',
    label: 'Music',
    pages: [
      { key: ADMIN_PAGE_KEYS.MUSIC_ARTISTS, label: 'Artists' },
      { key: ADMIN_PAGE_KEYS.MUSIC_OUTSIDE_ARTISTS, label: 'Outside Artists' },
      { key: ADMIN_PAGE_KEYS.MUSIC_ALBUMS, label: 'Albums' },
      { key: ADMIN_PAGE_KEYS.MUSIC_SONGS, label: 'Songs' },
      { key: ADMIN_PAGE_KEYS.MUSIC_RECORD_PLAYER, label: 'Record Player' },
      { key: ADMIN_PAGE_KEYS.MUSIC_CROSSHAIR, label: 'Crosshair' },
    ],
  },
  {
    key: 'fashion',
    label: 'Fashion',
    pages: [
      { key: ADMIN_PAGE_KEYS.FASHION_TALENT, label: 'Talent' },
      { key: ADMIN_PAGE_KEYS.FASHION_OUTSIDE_TALENT, label: 'Outside Talent' },
      { key: ADMIN_PAGE_KEYS.FASHION_COLLECTIONS, label: 'Collections' },
      { key: ADMIN_PAGE_KEYS.FASHION_LOOKS, label: 'Looks' },
    ],
  },
]

export const ADMIN_PAGE_PATHS = {
  [ADMIN_PAGE_KEYS.BOARD]: '/admin/board',
  [ADMIN_PAGE_KEYS.MUSIC_ARTISTS]: '/admin/artists',
  [ADMIN_PAGE_KEYS.MUSIC_OUTSIDE_ARTISTS]: '/admin/outside-artists',
  [ADMIN_PAGE_KEYS.MUSIC_ALBUMS]: '/admin/albums',
  [ADMIN_PAGE_KEYS.MUSIC_SONGS]: '/admin/songs',
  [ADMIN_PAGE_KEYS.MUSIC_RECORD_PLAYER]: '/admin/record-player',
  [ADMIN_PAGE_KEYS.MUSIC_CROSSHAIR]: '/admin/crosshair',
  [ADMIN_PAGE_KEYS.FASHION_TALENT]: '/admin/fashion/talent',
  [ADMIN_PAGE_KEYS.FASHION_OUTSIDE_TALENT]: '/admin/fashion/outside_talent',
  [ADMIN_PAGE_KEYS.FASHION_COLLECTIONS]: '/admin/fashion/collections',
  [ADMIN_PAGE_KEYS.FASHION_LOOKS]: '/admin/fashion/looks',
}

const VALID_PAGE_KEYS = new Set(Object.values(ADMIN_PAGE_KEYS))

export function normalizeAdminPageAccess(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((key) => VALID_PAGE_KEYS.has(key)))]
}

export function getDefaultAdminPageAccess(accountType) {
  if (accountType === ADMIN_ACCOUNT_TYPES.FASHION_TALENT) {
    return [ADMIN_PAGE_KEYS.FASHION_TALENT]
  }

  return [
    ADMIN_PAGE_KEYS.BOARD,
    ADMIN_PAGE_KEYS.MUSIC_ALBUMS,
    ADMIN_PAGE_KEYS.MUSIC_SONGS,
  ]
}

export function getAllowedPageGroupsForAccountType() {
  return ADMIN_PAGE_GROUPS
}

export function hasAdminPageAccess(session, pageKey) {
  if (!session || !pageKey) return false
  if (session.role === 'SUPER_ADMIN') return true

  const explicitAccess = normalizeAdminPageAccess(session.pageAccess)
  if (explicitAccess.length > 0) return explicitAccess.includes(pageKey)

  if (session.role === 'VIEWER') {
    return [
      ADMIN_PAGE_KEYS.BOARD,
      ADMIN_PAGE_KEYS.MUSIC_ARTISTS,
      ADMIN_PAGE_KEYS.MUSIC_ALBUMS,
      ADMIN_PAGE_KEYS.MUSIC_SONGS,
      ADMIN_PAGE_KEYS.MUSIC_RECORD_PLAYER,
    ].includes(pageKey)
  }

  if (session.role === 'ARTIST') return getDefaultAdminPageAccess(ADMIN_ACCOUNT_TYPES.MUSIC_ARTIST).includes(pageKey)
  if (session.role === 'TALENT') return getDefaultAdminPageAccess(ADMIN_ACCOUNT_TYPES.FASHION_TALENT).includes(pageKey)
  return false
}

export function firstAccessibleAdminPath(session) {
  if (session?.role === 'SUPER_ADMIN') return '/admin/about'

  const pageKey = Object.values(ADMIN_PAGE_KEYS).find((key) => hasAdminPageAccess(session, key))
  return pageKey ? ADMIN_PAGE_PATHS[pageKey] : '/admin/login'
}
