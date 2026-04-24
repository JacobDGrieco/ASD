import VinylRecord from './VinylRecord.jsx'
import styles from '../../styles/VinylRack.module.css'

export default function VinylRack({ tracks, activeTrackId, onSelect }) {
  return (
    <div className={styles.rack}>
      <div className={styles.slot_row}>
        {tracks.map((track) => (
          <VinylRecord
            key={track.id}
            track={track}
            isActive={activeTrackId === track.id}
            onClick={() => onSelect(track)}
          />
        ))}
      </div>
      <div className={styles.shelf} />
    </div>
  )
}
