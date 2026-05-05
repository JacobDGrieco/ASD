import { useEffect, useMemo, useState } from 'react'
import { prefetchApi, useApi } from '../hooks/useApi.js'
import ArtistSplash from '../components/home/ArtistSplash.jsx'
import RecordPlayer from '../components/home/RecordPlayer.jsx'
import AlbumCard from '../components/artist/AlbumCard.jsx'
import AuroraBackground from '../components/shared/AuroraBackground.jsx'
import { buildAlbumPath, buildSongPath } from '../lib/publicVisibility.js'
import '../styles/HomePage.css'

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
  const [artistDetails, setArtistDetails] = useState([])
  const apiMessage = getHomePageApiMessage(import.meta.env.DEV)

  useEffect(() => {
    if (!artists?.length) {
      setArtistDetails([])
      return
    }

    let cancelled = false

    Promise.all(
      artists.map((artist) =>
        prefetchApi(`/api/artists/${artist.slug}`)
          .then((detail) => detail ?? null)
          .catch(() => null)
      )
    ).then((details) => {
      if (!cancelled) setArtistDetails(details.filter(Boolean))
    })

    return () => {
      cancelled = true
    }
  }, [artists])

  const latestReleases = useMemo(() => {
    return artistDetails
      .flatMap((artist) =>
        (artist.albums ?? []).map((album) => ({
          ...album,
          artist: artist,
        }))
      )
      .sort((left, right) => new Date(right.releaseDate).getTime() - new Date(left.releaseDate).getTime())
      .slice(0, 6)
  }, [artistDetails])

  if ((artistsError || tracksError) && !artists && !tracks) {
    return (
      <div className="page aurora-page">
        <AuroraBackground />
        <div className="aurora-page-content home-status">
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
      </div>
    )
  }

  return (
    <div className="page aurora-page">
      <AuroraBackground />
      <div className="aurora-page-content home-page-content">
        {artists && <ArtistSplash artists={artists} />}
        {!tracksLoading && (
          <RecordPlayer
            tracks={tracks ?? []}
            message={tracksError ? 'The home page could not load record-player tracks from the API.' : null}
          />
        )}
        <section className="home-about">
          <div className="home-about-copy">
            <p className="home-section-eyebrow">The Label</p>
            <h2 className="home-about-title">Independent music from the underground.</h2>
            <p>
              ASD Records is an independent collective built around artists who move outside the expected lane.
              Each release is shaped with a hands-on approach, from early demos to the final visual world around it.
            </p>
            <p>
              The catalog spans intimate singles, sharper experimental projects, and collaborative drops that keep the label rooted in its own scene instead of chasing a template.
            </p>
          </div>
          <div className="home-latest home-latest-inline">
            {latestReleases.length > 0 ? (
              <div className="home-latest-row" aria-label="Latest releases">
                {latestReleases.map((album) => {
                  const singleSong = album.songs?.length === 1 ? album.songs[0] : null
                  const leadSong = singleSong ?? album.songs?.[0] ?? null
                  const to = singleSong
                    ? buildSongPath({
                        songSlug: singleSong.slug,
                        albumSlug: album.slug,
                        artistSlug: album.artist?.slug,
                        artist: album.artist,
                      })
                    : buildAlbumPath({
                        albumSlug: album.slug,
                        artistSlug: album.artist?.slug,
                        artist: album.artist,
                      }) ?? buildSongPath({
                        songSlug: leadSong?.slug,
                        albumSlug: album.slug,
                        artistSlug: album.artist?.slug,
                        artist: album.artist,
                      })

                  return (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      subtitle={album.artist?.name}
                      to={to}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="home-latest-empty">Latest releases will appear here once public catalog data is available.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
