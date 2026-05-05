import { prefetchApi, useApi } from '../hooks/useApi.js'
import ArtistSplash from '../components/home/ArtistSplash.jsx'
import RecordPlayer from '../components/home/RecordPlayer.jsx'

void prefetchApi('/api/artists')
void prefetchApi('/api/record-player')

export function getHomePageApiMessage(isDev) {
  if (isDev) {
    return 'The frontend dev server is up, but the API is not reachable. Start `npm run dev:vercel` in another terminal so `/api` can proxy to the local Vercel functions on port 3000, or use `npm run dev:vercel` by itself.'
  }

  return 'The frontend loaded, but the site could not reach its API routes. This usually means the deployment is missing environment variables, database access, or a failing serverless function.'
}

export default function HomePage() {
  const {
    data: artists,
    error: artistsError,
  } = useApi('/api/artists', { refreshAtUtcMidnight: true })
  const {
    data: tracks,
    loading: tracksLoading,
    error: tracksError,
  } = useApi('/api/record-player', { refreshAtUtcMidnight: true })
  const apiMessage = getHomePageApiMessage(import.meta.env.DEV)

  if ((artistsError || tracksError) && !artists && !tracks) {
    return (
      <div className="page home-status">
        <div className="home-status__panel">
          <p className="home-status__eyebrow">Content unavailable</p>
          <h1>Local API requests failed.</h1>
          <p>{apiMessage}</p>
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
      {!tracksLoading && (
        <RecordPlayer
          tracks={tracks ?? []}
          message={tracksError ? 'The home page could not load record-player tracks from the API.' : null}
        />
      )}
    </div>
  )
}
