import { useMemo, useState } from 'react'
import { FaPlay, FaRandom } from 'react-icons/fa'
import { prefetchApi } from '../../hooks/useApi.js'
import { usePlayer } from '../../lib/playerContext.jsx'

function playerPoolUrl({ type, id, slug }) {
  const params = new URLSearchParams({ type })
  if (id) params.set('id', id)
  if (slug) params.set('slug', slug)
  return `/api/player-pool?${params.toString()}`
}

export default function PlayButton({
  type,
  id = '',
  slug = '',
  startSongId = '',
  sourceLabel = '',
  shuffle = false,
  label = shuffle ? 'Shuffle' : 'Play',
  className = '',
  iconOnly = false,
  disabled = false,
}) {
  const { playPool } = usePlayer()
  const [loading, setLoading] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState('')
  const url = useMemo(() => playerPoolUrl({ type, id, slug }), [id, slug, type])
  const isDisabled = disabled || loading || empty
  const title = empty ? 'No streamable tracks' : error || label

  const handleClick = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (isDisabled) return

    setLoading(true)
    setError('')

    try {
      const data = await prefetchApi(url, { maxAge: 30 * 1000 })
      const pool = Array.isArray(data?.pool) ? data.pool : []
      if (!pool.length) {
        setEmpty(true)
        return
      }

      const startIndex = startSongId
        ? Math.max(0, pool.findIndex((song) => song.id === startSongId))
        : Math.max(0, data?.startIndex ?? 0)

      playPool(pool, {
        startIndex,
        source: sourceLabel || data?.sourceLabel || '',
        shuffle,
      })
    } catch {
      setError('Player unavailable')
      window.setTimeout(() => setError(''), 2200)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className={`player-play-button ${iconOnly ? 'player-play-button-icon' : ''} ${className}`.trim()}
      onClick={handleClick}
      disabled={isDisabled}
      title={title}
      aria-label={title}
      data-error={error ? 'true' : undefined}
    >
      {shuffle ? <FaRandom aria-hidden="true" /> : <FaPlay aria-hidden="true" />}
      {!iconOnly && <span>{loading ? 'Loading' : error || label}</span>}
    </button>
  )
}
