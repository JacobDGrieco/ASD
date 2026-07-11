import { useMemo } from 'react'

const EMBED_HEIGHT_BY_TYPE = {
  track: 152,
  album: 352,
  playlist: 352,
  show: 352,
  episode: 232,
  artist: 352,
}

function parseSpotifyResource(url) {
  if (!url || typeof url !== 'string') return null

  const trimmedUrl = url.trim()
  if (!trimmedUrl) return null

  if (trimmedUrl.startsWith('spotify:')) {
    const [, type, id] = trimmedUrl.split(':')
    if (!type || !id) return null
    return { type, id }
  }

  try {
    const parsed = new URL(trimmedUrl)
    const host = parsed.hostname.replace(/^www\./, '')

    if (!host.endsWith('spotify.com')) return null

    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments[0] === 'intl' && segments.length >= 4) {
      const [, , type, id] = segments
      return type && id ? { type, id } : null
    }

    if (segments[0] === 'embed' && segments.length >= 3) {
      const [, type, id] = segments
      return type && id ? { type, id } : null
    }

    const [type, id] = segments
    return type && id ? { type, id } : null
  } catch {
    return null
  }
}

export default function SpotifyPlayer({ url, theme = '0', onPlay = null }) {
  const resource = useMemo(() => parseSpotifyResource(url), [url])

  const src = useMemo(() => {
    if (!resource?.type || !resource?.id) return null
    return `https://open.spotify.com/embed/${resource.type}/${resource.id}?utm_source=generator&theme=${theme}`
  }, [resource, theme])

  if (!src) return null

  const height = EMBED_HEIGHT_BY_TYPE[resource.type] ?? 152

  return (
    <iframe
      title="Spotify Player"
      src={src}
      onFocus={onPlay ?? undefined}
      width="100%"
      height={String(height)}
      frameBorder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      style={{ borderRadius: '12px' }}
    />
  )
}
