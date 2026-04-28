export const ARTIST_VIDEO_SOURCE = {
  YOUTUBE: 'YOUTUBE',
  UPLOAD: 'UPLOAD',
}

function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== 'string') return ''
  return baseUrl.trim().replace(/\/+$/, '')
}

export function buildStaticArtistVideoPath(artistSlug, baseUrl = '') {
  if (typeof artistSlug !== 'string' || !artistSlug.trim()) return null
  const normalizedBase = normalizeBaseUrl(baseUrl)
  const blobPath = `videos/${artistSlug.trim()}.mp4`
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
