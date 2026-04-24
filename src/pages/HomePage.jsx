import { useApi } from '../hooks/useApi.js'
import ArtistSplash from '../components/home/ArtistSplash.jsx'
import RecordPlayer from '../components/home/RecordPlayer.jsx'

export default function HomePage() {
  const { data: artists, loading: artistsLoading } = useApi('/api/artists')
  const { data: tracks, loading: tracksLoading } = useApi('/api/record-player')

  if (artistsLoading || tracksLoading) {
    return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-muted)' }}>Loading…</div>
  }

  return (
    <div className="page">
      {artists && <ArtistSplash artists={artists} />}
      {tracks && tracks.length > 0 && <RecordPlayer tracks={tracks} />}
    </div>
  )
}
