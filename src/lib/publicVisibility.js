export const OTHER_ARTIST_NAME = 'Other'
export const OTHER_ARTIST_SLUG = 'other'
export const OTHER_ARTIST_OPTION_ID = '__other__'

function normalizeValue(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function isOtherArtist(value) {
  if (!value) return false

  if (typeof value === 'string') {
    const normalized = normalizeValue(value)
    return normalized === OTHER_ARTIST_NAME.toLowerCase() || normalized === OTHER_ARTIST_SLUG
  }

  return (
    normalizeValue(value.slug) === OTHER_ARTIST_SLUG ||
    normalizeValue(value.name) === OTHER_ARTIST_NAME.toLowerCase()
  )
}

export function buildSongPath({ songSlug, albumSlug = null, artistSlug = null, artist = null }) {
  if (!songSlug) return null

  const isOther = isOtherArtist(artist ?? artistSlug)
  if (isOther) {
    const params = albumSlug ? `?albumSlug=${encodeURIComponent(albumSlug)}` : ''
    return `/songs/${songSlug}${params}`
  }

  if (!artistSlug || !albumSlug) return null
  return `/${artistSlug}/${albumSlug}/${songSlug}`
}

export function buildAlbumPath({ albumSlug, artistSlug = null, artist = null }) {
  if (!albumSlug) return null
  if (isOtherArtist(artist ?? artistSlug)) return null
  if (!artistSlug) return null

  return `/${artistSlug}/${albumSlug}`
}
