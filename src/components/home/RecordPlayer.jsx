import { useState } from 'react'
import Turntable from './Turntable.jsx'
import VinylRack from './VinylRack.jsx'
import styles from '../../styles/RecordPlayer.module.css'

export default function RecordPlayer({ tracks }) {
  const [activeTrack, setActiveTrack] = useState(null)

  function handleSelect(track) {
    setActiveTrack((prev) => (prev?.id === track.id ? null : track))
  }

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
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
