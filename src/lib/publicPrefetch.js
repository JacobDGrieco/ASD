/**
 * Hover/navigation-triggered warmup helpers: prefetches a page's API data and its
 * lead images before the user actually navigates, so the destination page feels
 * instant. Client-only. `imageWarmups` dedupes concurrent preloads of the same URL.
 */
import { prefetchApi } from '../hooks/useApi.js'

const imageWarmups = new Map()

/** Preloads a single image via a detached `Image` element, resolving (never rejecting) once it loads or errors. */
export function preloadImage(url, { priority = 'auto' } = {}) {
  if (!url || typeof window === 'undefined') return Promise.resolve(null)
  if (imageWarmups.has(url)) return imageWarmups.get(url)

  const request = new Promise((resolve) => {
    const image = new window.Image()

    if (priority !== 'auto' && 'fetchPriority' in image) {
      image.fetchPriority = priority
    }

    image.decoding = 'async'
    image.loading = 'eager'
    image.onload = () => resolve(url)
    image.onerror = () => resolve(null)
    image.src = url
  })

  imageWarmups.set(url, request)
  return request
}

/** Preloads a deduplicated list of image URLs in parallel. */
export function preloadImages(urls, options) {
  const uniqueUrls = [...new Set((Array.isArray(urls) ? urls : []).filter(Boolean))]
  return Promise.all(uniqueUrls.map((url) => preloadImage(url, options)))
}

/** Warms an artist page's API response and its first 4 images (portrait + gallery), e.g. on nav-link hover. */
export function prefetchArtistPage(artist) {
  if (!artist?.slug) return

  prefetchApi(`/api/artists/${artist.slug}`).catch(() => {})

  const images = Array.isArray(artist.images)
    ? artist.images.flatMap((image) => {
      const url = image?.previewUrl || image?.url
      return url ? [url] : []
    })
    : []

  void preloadImages([artist.portrait, ...images].slice(0, 4), { priority: 'high' })
}

/** Warms a song page's API response and its cover art. */
export function prefetchSongPage(id, coverArt) {
  if (!id) return
  prefetchApi(`/api/songs/${id}`).catch(() => {})
  void preloadImage(coverArt, { priority: 'high' })
}
