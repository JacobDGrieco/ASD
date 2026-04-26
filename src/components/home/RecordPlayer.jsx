import { useEffect, useState } from 'react'
import Turntable from './Turntable.jsx'
import VinylRack from './VinylRack.jsx'
import { preloadImages } from '../../lib/publicPrefetch.js'
import '../../styles/RecordPlayer.css'

export default function RecordPlayer({ tracks }) {
  const [activeTrack, setActiveTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const coverArtUrls = tracks
      .map((track) => track?.song?.album?.coverArt)
      .filter(Boolean)

    void preloadImages(coverArtUrls, { priority: 'high' })
  }, [tracks])

  function handleSelect(track) {
    setActiveTrack((prev) => {
      if (prev?.id === track.id) {
        setIsPlaying(false)
        return null
      }

      setIsPlaying(true)
      return track
    })
  }

  function handleTonearmToggle() {
    if (!activeTrack?.song.soundcloudUrl) return
    setIsPlaying((prev) => !prev)
  }

  return (
    <section className="record-player-section">
      <div className="record-player-inner">
        <Turntable
          activeTrack={activeTrack}
          isPlaying={isPlaying}
          onTonearmToggle={handleTonearmToggle}
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
