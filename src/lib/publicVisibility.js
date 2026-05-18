export const OTHER_ARTIST_NAME = 'Other'
export const OTHER_ARTIST_SLUG = 'other'
export const OTHER_ARTIST_OPTION_ID = '__other__'
export const ASD_RECORDS_ARTIST_NAME = 'ASD Records'
export const ASD_RECORDS_ARTIST_SLUG = 'asd-records'
export const ASD_RECORDS_ARTIST_OPTION_ID = '__asd_records__'

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

export function isAsdRecordsArtist(value) {
  if (!value) return false

  if (typeof value === 'string') {
    const normalized = normalizeValue(value)
    return normalized === ASD_RECORDS_ARTIST_NAME.toLowerCase() || normalized === ASD_RECORDS_ARTIST_SLUG
  }

  return (
    normalizeValue(value.slug) === ASD_RECORDS_ARTIST_SLUG ||
    normalizeValue(value.name) === ASD_RECORDS_ARTIST_NAME.toLowerCase()
  )
}

export function isReservedHiddenArtist(value) {
  return isOtherArtist(value) || isAsdRecordsArtist(value)
}

export function hasPublicArtistPage(value) {
  if (!value) return false
  if (isReservedHiddenArtist(value)) return false
  if (typeof value === 'object' && value.isVisible === false) return false
  return true
}

export function buildSongPath({ songSlug, albumSlug = null, artistSlug = null, artist = null }) {
  if (!songSlug) return null

  const isOther = isOtherArtist(artist ?? artistSlug)
  if (isOther || isAsdRecordsArtist(artist ?? artistSlug)) {
    const params = albumSlug ? `?albumSlug=${encodeURIComponent(albumSlug)}` : ''
    return `/songs/${songSlug}${params}`
  }

  if (artist && !hasPublicArtistPage(artist)) return null
  if (!artistSlug || !albumSlug) return null
  return `/${artistSlug}/${albumSlug}/${songSlug}`
}

export function buildAlbumPath({ albumSlug, artistSlug = null, artist = null }) {
  if (!albumSlug) return null
  if (artist && !hasPublicArtistPage(artist)) return null
  if (isReservedHiddenArtist(artist ?? artistSlug)) return null
  if (!artistSlug) return null

  return `/${artistSlug}/${albumSlug}`
}
