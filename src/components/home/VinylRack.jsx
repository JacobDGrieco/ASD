import VinylRecord from './VinylRecord.jsx'
import '../../styles/VinylRack.css'

export default function VinylRack({ tracks, activeTrackId, onSelect }) {
  return (
    <div className="vinyl-rack-rack">
      <div className="vinyl-rack-slot-row">
        {tracks.map((track) => (
          <VinylRecord
            key={track.id}
            track={track}
            isActive={activeTrackId === track.id}
            onClick={() => onSelect(track)}
          />
        ))}
      </div>
      <div className="vinyl-rack-shelf" />
    </div>
  )
}
