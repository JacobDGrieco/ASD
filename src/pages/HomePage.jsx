import { useApi } from '../hooks/useApi.js'
import ArtistSplash from '../components/home/ArtistSplash.jsx'
import RecordPlayer from '../components/home/RecordPlayer.jsx'

export default function HomePage() {
  const {
    data: artists,
    loading: artistsLoading,
    error: artistsError,
  } = useApi('/api/artists')
  const {
    data: tracks,
    loading: tracksLoading,
    error: tracksError,
  } = useApi('/api/record-player')

  if (artistsLoading || tracksLoading) {
    return (
      <div className="page home-status" style={{ color: 'var(--text-muted)' }}>
        Loading...
      </div>
    )
  }

  if (artistsError || tracksError) {
    return (
      <div className="page home-status">
        <div className="home-status__panel">
          <p className="home-status__eyebrow">Content unavailable</p>
          <h1>Local API requests failed.</h1>
          <p>
            This page needs the Vercel API routes as well as the frontend. Run
            `npm run dev:vercel` for full-stack local development.
          </p>
          <p className="home-status__detail">
            Artists request: {artistsError ?? 'ok'}
            <br />
            Record player request: {tracksError ?? 'ok'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {artists && <ArtistSplash artists={artists} />}
      {tracks && tracks.length > 0 && <RecordPlayer tracks={tracks} />}
    </div>
  )
}
