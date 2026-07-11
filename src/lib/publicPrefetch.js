import { prefetchApi } from '../hooks/useApi.js'

const imageWarmups = new Map()

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

export function preloadImages(urls, options) {
  const uniqueUrls = [...new Set((Array.isArray(urls) ? urls : []).filter(Boolean))]
  return Promise.all(uniqueUrls.map((url) => preloadImage(url, options)))
}

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

export function prefetchSongPage(id, coverArt) {
  if (!id) return
  prefetchApi(`/api/songs/${id}`).catch(() => {})
  void preloadImage(coverArt, { priority: 'high' })
}
