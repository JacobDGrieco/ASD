import VinylRecord from './VinylRecord.jsx';
import '../../styles/VinylRack.css';

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
			<p className="vinyl-rack-instructions">
				Pick a record from the rack. Click on the record again to fully stop the music. Use the tonearm to play/pause the song.
			</p>
		</div>
	);
}
