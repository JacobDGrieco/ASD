import { useState } from 'react'
import Turntable from './Turntable.jsx'
import VinylRack from './VinylRack.jsx'
import '../../styles/RecordPlayer.css'

export default function RecordPlayer({ tracks }) {
  const [activeTrack, setActiveTrack] = useState(null)

  function handleSelect(track) {
    setActiveTrack((prev) => (prev?.id === track.id ? null : track))
  }

  return (
    <section className="record-player-section">
      <div className="record-player-inner">
        <Turntable activeTrack={activeTrack} isPlaying={activeTrack !== null} />
        <VinylRack
          tracks={tracks}
          activeTrackId={activeTrack?.id ?? null}
          onSelect={handleSelect}
        />
      </div>
    </section>
  )
}
