import { Link } from 'react-router-dom';
import { prefetchSongPage } from '../../lib/publicPrefetch.js';
import { buildSongPath } from '../../lib/publicVisibility.js';
import '../../styles/TrackList.css';

export default function TrackList({ songs, artistSlug, albumSlug, albumHref, albumTitle, artist = null, allowHidden = false }) {
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
					to={buildSongPath({
						songSlug: song.slug,
						albumSlug,
						artistSlug,
						artist,
						song,
						allowHidden,
					}) ?? `/${artistSlug}/${albumSlug}/${song.slug}`}
					className={`track-list-row ${song.isPubliclyVisible === false ? 'track-list-row-hidden' : ''}`.trim()}
					onMouseEnter={() => prefetchSongPage(song.slug, null, albumSlug)}
					onFocus={() => prefetchSongPage(song.slug, null, albumSlug)}
					onTouchStart={() => prefetchSongPage(song.slug, null, albumSlug)}
				>
					<span className="track-list-num">{song.discNumber > 1 ? `${song.discNumber}-` : ''}{song.trackNumber}</span>
					<span className="track-list-title">{song.title}</span>
					<span className="track-list-duration">{song.duration}</span>
				</Link>
			))}
		</div>
	);
}
