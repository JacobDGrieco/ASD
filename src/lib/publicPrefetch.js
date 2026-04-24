import { prefetchApi } from '../hooks/useApi.js'

function preloadImage(url) {
  if (!url || typeof window === 'undefined') return
  const image = new window.Image()
  image.src = url
}

export function prefetchArtistPage(artist) {
  if (!artist?.slug) return

  prefetchApi(`/api/artists/${artist.slug}`).catch(() => {})

  const images = Array.isArray(artist.images)
    ? artist.images.map((image) => image?.previewUrl || image?.url).filter(Boolean)
    : []

  images.slice(0, 2).forEach(preloadImage)
  preloadImage(artist.portrait)
}

export function prefetchSongPage(slug, coverArt) {
  if (!slug) return

  prefetchApi(`/api/songs/${slug}`).catch(() => {})
  preloadImage(coverArt)
}
