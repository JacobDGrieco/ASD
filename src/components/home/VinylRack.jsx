import VinylRecord from './VinylRecord.jsx'
import '../../styles/VinylRack.css'

export default function VinylRack({ tracks, activeTrackId, onSelect }) {
  return (
    <div className="vinyl-rack-rack">
      <div className="vinyl-rack-slot-row">
        {tracks.map((track, index) => (
          <VinylRecord
            key={track.id}
            track={track}
            isActive={activeTrackId === track.id}
            onClick={() => onSelect(track)}
            imagePriority={index < 4 ? 'high' : 'auto'}
            shouldEagerLoad={index < 4}
          />
        ))}
      </div>
      <div className="vinyl-rack-shelf" />
    </div>
  )
}
