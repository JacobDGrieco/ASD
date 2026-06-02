export const ARTIST_VIDEO_SOURCE = {
  YOUTUBE: 'YOUTUBE',
  UPLOAD: 'UPLOAD',
}

const DEFAULT_STATIC_VIDEO_EXTENSION = 'mp4'

function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== 'string') return ''
  return baseUrl.trim().replace(/\/+$/, '')
}

function normalizeVideoExtension(extension) {
  if (typeof extension !== 'string') return DEFAULT_STATIC_VIDEO_EXTENSION
  const normalized = extension.trim().toLowerCase().replace(/^\./, '')
  return normalized || DEFAULT_STATIC_VIDEO_EXTENSION
}

export function getVideoMimeType(url) {
  if (typeof url !== 'string') return undefined
  const extension = getStaticArtistVideoExtension(url)
  if (extension === 'mov') return 'video/quicktime'
  if (extension === 'webm') return 'video/webm'
  if (extension === 'ogg' || extension === 'ogv') return 'video/ogg'
  return 'video/mp4'
}

export function getVideoSourceType(url) {
  const extension = getStaticArtistVideoExtension(url)
  if (extension === 'mov') return undefined
  return getVideoMimeType(url)
}

export function getPlayableVideoUrl(url) {
  if (typeof url !== 'string' || !url) return url
  if (!url.startsWith('/api/blob?')) return url

  try {
    const parsed = new URL(url, 'https://local.invalid')
    parsed.searchParams.set('redirect', '1')
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return `${url}${url.includes('?') ? '&' : '?'}redirect=1`
  }
}

export function getStaticArtistVideoExtension(value, fallback = DEFAULT_STATIC_VIDEO_EXTENSION) {
  if (typeof value !== 'string' || !value.trim()) return normalizeVideoExtension(fallback)

  const trimmed = value.trim()

  try {
    const parsed = new URL(trimmed, 'https://local.invalid')
    const pathnameParam = parsed.searchParams.get('pathname')
    const candidatePath = pathnameParam || parsed.pathname
    const extension = candidatePath.match(/\.([a-z0-9]+)$/i)?.[1]
    return normalizeVideoExtension(extension || fallback)
  } catch {
    const extension = trimmed.match(/\.([a-z0-9]+)$/i)?.[1]
    return normalizeVideoExtension(extension || fallback)
  }
}

export function buildStaticArtistVideoPath(artistSlug, baseUrl = '', extension = DEFAULT_STATIC_VIDEO_EXTENSION) {
  if (typeof artistSlug !== 'string' || !artistSlug.trim()) return null
  const normalizedBase = normalizeBaseUrl(baseUrl)
  const blobPath = `videos/${artistSlug.trim()}.${normalizeVideoExtension(extension)}`
  if (normalizedBase) return `${normalizedBase}/${blobPath}`
  return `/api/blob?pathname=${encodeURIComponent(blobPath)}`
}

export function getYouTubeVideoId(url) {
  if (typeof url !== 'string' || !url.trim()) return null

  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()

    if (host === 'youtu.be') {
      return parsed.pathname.split('/').filter(Boolean)[0] ?? null
    }

    if (host.includes('youtube.com')) {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v')
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/').filter(Boolean)[1] ?? null
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/').filter(Boolean)[1] ?? null
    }
  } catch {
    return null
  }

  return null
}

export function getYouTubeEmbedUrl(url) {
  const videoId = getYouTubeVideoId(url)
  if (!videoId) return null
  return `https://www.youtube.com/embed/${videoId}?rel=0`
}

export function normalizeArtistVideoInput(input = {}) {
  const sourceType = input.sourceType === ARTIST_VIDEO_SOURCE.UPLOAD
    ? ARTIST_VIDEO_SOURCE.UPLOAD
    : input.sourceType === ARTIST_VIDEO_SOURCE.YOUTUBE
      ? ARTIST_VIDEO_SOURCE.YOUTUBE
      : null

  return {
    artistId: typeof input.artistId === 'string' ? input.artistId : '',
    title: typeof input.title === 'string' && input.title.trim() ? input.title.trim() : null,
    description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : null,
    posterUrl: typeof input.posterUrl === 'string' && input.posterUrl.trim() ? input.posterUrl.trim() : null,
    posterPathname: typeof input.posterPathname === 'string' && input.posterPathname.trim() ? input.posterPathname.trim() : null,
    sourceType,
    youtubeUrl: sourceType === ARTIST_VIDEO_SOURCE.YOUTUBE && typeof input.youtubeUrl === 'string' && input.youtubeUrl.trim()
      ? input.youtubeUrl.trim()
      : null,
    videoUrl: sourceType === ARTIST_VIDEO_SOURCE.UPLOAD && typeof input.videoUrl === 'string' && input.videoUrl.trim()
      ? input.videoUrl.trim()
      : null,
    videosPageUrl: typeof input.videosPageUrl === 'string' && input.videosPageUrl.trim() ? input.videosPageUrl.trim() : null,
  }
}

export function validateArtistVideoInput(input) {
  if (!input.artistId) return 'Artist is required.'
  if (!input.sourceType && (input.youtubeUrl || input.videoUrl)) {
    return 'Choose a source type when adding video content.'
  }
  if (input.sourceType === ARTIST_VIDEO_SOURCE.YOUTUBE && !input.youtubeUrl) return 'A YouTube URL is required for YouTube videos.'
  if (input.sourceType === ARTIST_VIDEO_SOURCE.UPLOAD && !input.videoUrl) return 'A local/static video path is required for uploaded videos.'
  return null
}
