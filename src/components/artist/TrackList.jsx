import { Link } from 'react-router-dom';
import { prefetchSongPage } from '../../lib/publicPrefetch.js';
import { buildSongPath } from '../../lib/publicVisibility.js';
import '../../styles/TrackList.css';

export default function TrackList({ songs, albumHref = null, allowHidden = false }) {
	return (
		<div className="track-list-list">
			{albumHref && (
				<div className="track-list-toolbar">
					<Link to={albumHref} className="track-list-album-link">
						Open Album Page
					</Link>
				</div>
			)}
			{songs.map((song) => (
				<Link
					key={song.id}
					to={buildSongPath({ song, allowHidden }) ?? '/'}
					className={`track-list-row ${song.isPubliclyVisible === false ? 'track-list-row-hidden' : ''}`.trim()}
					onMouseEnter={() => prefetchSongPage(song.id, null)}
					onFocus={() => prefetchSongPage(song.id, null)}
					onTouchStart={() => prefetchSongPage(song.id, null)}
				>
					<span className="track-list-num">{song.discNumber > 1 ? `${song.discNumber}-` : ''}{song.trackNumber}</span>
					<span className="track-list-title">{song.title}</span>
					<span className="track-list-duration">{song.duration}</span>
				</Link>
			))}
		</div>
	);
}
