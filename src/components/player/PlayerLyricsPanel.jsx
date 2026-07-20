import { useApi } from '../../hooks/useApi.js'
import LyricsView from '../song/LyricsView.jsx'

export default function PlayerLyricsPanel({ song }) {
  const { data, loading, error } = useApi(song?.id ? `/api/songs/${song.id}` : null, {
    refreshAtUtcMidnight: true,
  })

  if (loading && !data) {
    return (
      <div className="player-panel-empty" aria-label="Loading lyrics">
        <span className="player-panel-spinner" aria-hidden="true" />
      </div>
    )
  }

  if (error || !data?.lyric?.text) {
    return <div className="player-panel-empty">Lyrics unavailable</div>
  }

  return (
    <div className="player-lyrics-panel">
      <LyricsView lyric={data.lyric} />
    </div>
  )
}
