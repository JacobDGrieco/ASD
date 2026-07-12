import { useEffect, useState } from 'react'
import Turntable from './Turntable.jsx'
import VinylRack from './VinylRack.jsx'
import { preloadImages } from '../../lib/publicPrefetch.js'
import '../../styles/RecordPlayer.css'

export default function RecordPlayer({ tracks, message = null }) {
  const hasTracks = Array.isArray(tracks) && tracks.length > 0

  useEffect(() => {
    if (!hasTracks) return undefined

    const coverArtUrls = tracks.flatMap((track) => {
      const coverArt = track?.song?.album?.coverArt
      return coverArt ? [coverArt] : []
    })

    void preloadImages(coverArtUrls, { priority: 'high' })
    return undefined
  }, [hasTracks, tracks])

  if (!hasTracks) {
    return (
      <section className="record-player-section">
        <div className="record-player-empty">
          <p className="record-player-empty-eyebrow">Record Player</p>
          <h2>No tracks are loaded right now.</h2>
          <p>{message ?? 'Assign active songs in the admin record-player page to show the vinyl rack on the home page.'}</p>
        </div>
      </section>
    )
  }

  return <RecordPlayerDeck tracks={tracks} />
}

function RecordPlayerDeck({ tracks }) {
  const [activeTrack, setActiveTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [pendingAutoPlay, setPendingAutoPlay] = useState(false)

  function handleSelect(track) {
    const isDeselecting = activeTrack?.id === track.id
    setIsPlaying(false)
    setPendingAutoPlay(isDeselecting ? false : Boolean(track.song.soundcloudUrl))
    setActiveTrack(isDeselecting ? null : track)
  }

  function handleTonearmToggle() {
    if (!activeTrack?.song.soundcloudUrl) return
    setPendingAutoPlay(false)
    setIsPlaying((prev) => !prev)
  }

  function handlePlaybackStart() {
    setPendingAutoPlay(false)
    setIsPlaying(true)
  }

  function handlePlaybackPause() {
    setPendingAutoPlay(false)
    setIsPlaying(false)
  }

  function handlePlaybackEnd() {
    setPendingAutoPlay(false)
    setIsPlaying(false)
    setActiveTrack(null)
  }

  return (
    <section className="record-player-section">
      <div className="record-player-inner">
        <Turntable
          activeTrack={activeTrack}
          isPlaying={isPlaying}
          autoPlayOnReady={pendingAutoPlay}
          onTonearmToggle={handleTonearmToggle}
          onPlaybackStart={handlePlaybackStart}
          onPlaybackPause={handlePlaybackPause}
          onPlaybackEnd={handlePlaybackEnd}
        />
        <VinylRack
          tracks={tracks}
          activeTrackId={activeTrack?.id ?? null}
          onSelect={handleSelect}
        />
      </div>
    </section>
  )
}
