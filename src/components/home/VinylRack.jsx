import VinylRecord from './VinylRecord.jsx';
import '../../styles/VinylRack.css';

const RACK_ROW_SIZE = 4;
const MAX_RACK_TRACKS = 8;

export default function VinylRack({ tracks, activeTrackId, onSelect }) {
	const rackTracks = tracks.slice(0, MAX_RACK_TRACKS);
	const trackRows = Array.from(
		{ length: Math.ceil(rackTracks.length / RACK_ROW_SIZE) },
		(_, rowIndex) => rackTracks.slice(rowIndex * RACK_ROW_SIZE, rowIndex * RACK_ROW_SIZE + RACK_ROW_SIZE)
	);

	return (
		<div className="vinyl-rack-rack">
			{trackRows.map((row, rowIndex) => (
				<div
					key={rowIndex}
					className="vinyl-rack-tier"
				>
					<div className={`vinyl-rack-slot-row ${rowIndex > 0 ? 'vinyl-rack-slot-row-centered' : ''}`.trim()}>
						{row.map((track, columnIndex) => {
							const index = rowIndex * RACK_ROW_SIZE + columnIndex;

							return (
								<VinylRecord
									key={track.id}
									track={track}
									isActive={activeTrackId === track.id}
									onClick={() => onSelect(track)}
									imagePriority={index < 4 ? 'high' : 'auto'}
									shouldEagerLoad={index < 4}
								/>
							);
						})}
					</div>
					<div className="vinyl-rack-shelf" />
				</div>
			))}
			<p className="vinyl-rack-instructions">
				Pick a record from the rack. Click on the record again to fully stop the music. Use the tonearm to play/pause the song.
			</p>
		</div>
	);
}
