/**
 * Hover/navigation-triggered warmup helpers: prefetches a page's API data and its
 * lead images before the user actually navigates, so the destination page feels
 * instant. Client-only. `imageWarmups` dedupes concurrent preloads of the same URL.
 */
import { prefetchApi } from '../hooks/useApi.js'

const imageWarmups = new Map()

export function scheduleIdleWork(callback, { timeout = 1500 } = {}) {
  if (typeof window === 'undefined') return null

  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, { timeout })
  }

  return window.setTimeout(() => {
    callback({ didTimeout: true, timeRemaining: () => 0 })
  }, Math.min(timeout, 250))
}

export function cancelIdleWork(id) {
  if (id === null || id === undefined || typeof window === 'undefined') return

  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(id)
    return
  }

  window.clearTimeout(id)
}

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

/** Warms the first visible artist detail pages in idle time after the music homepage settles. */
export function prefetchArtistPagesInIdle(artists, { limit = 6, timeout = 1200 } = {}) {
  const candidates = (Array.isArray(artists) ? artists : [])
    .filter((artist) => artist?.slug)
    .slice(0, limit)

  const idleIds = candidates.map((artist, index) => (
    scheduleIdleWork(() => prefetchArtistPage(artist), { timeout: timeout + index * 180 })
  ))

  return () => idleIds.forEach(cancelIdleWork)
}

/** Warms a player pool response and the first few cover images before playback starts. */
export function prefetchPlayerPool(url, { maxAge = 30 * 1000, artworkLimit = 4 } = {}) {
  return prefetchApi(url, { maxAge }).then((data) => {
    const pool = Array.isArray(data?.pool) ? data.pool : []
    void preloadImages(pool.map((song) => song?.artworkUrl).slice(0, artworkLimit), { priority: 'high' })
    return data
  })
}

/** Warms a song page's API response and its cover art. */
export function prefetchSongPage(id, coverArt) {
  if (!id) return
  prefetchApi(`/api/songs/${id}`).catch(() => {})
  void preloadImage(coverArt, { priority: 'high' })
}
