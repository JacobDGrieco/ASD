/**
 * Public track list component for album/release pages.
 *
 * Handles song navigation and play actions while preserving album placement order.
 */
import { Link, useNavigate } from 'react-router-dom';
import PlayButton from '../player/PlayButton.jsx';
import { prefetchSongPage } from '../../lib/publicPrefetch.js';
import { buildSongPath } from '../../lib/publicVisibility.js';
import '../../styles/TrackList.css';

export default function TrackList({
	songs,
	albumHref = null,
	albumTitle = '',
	allowHidden = false,
	playerPoolType = '',
	playerPoolId = '',
	playerPoolSlug = '',
	playerSourceLabel = '',
}) {
	const navigate = useNavigate();

	const openSong = (song) => {
		const path = buildSongPath({ song, allowHidden });
		if (path) navigate(path);
	};

	return (
		<div className="track-list-list">
			{albumHref && (
				<div className="track-list-toolbar">
					{albumTitle && (
						<span className="track-list-album-title" title={albumTitle}>
							{albumTitle}
						</span>
					)}
					<Link to={albumHref} className="track-list-album-link">
						Open Album Page
					</Link>
				</div>
			)}
			{songs.map((song) => {
				const songPath = buildSongPath({ song, allowHidden });
				return (
					<div
						key={song.id}
						role={songPath ? 'link' : undefined}
						tabIndex={songPath ? 0 : undefined}
						className={`track-list-row ${song.isPubliclyVisible === false ? 'track-list-row-hidden' : ''}`.trim()}
						onMouseEnter={() => prefetchSongPage(song.id, null)}
						onFocus={() => prefetchSongPage(song.id, null)}
						onTouchStart={() => prefetchSongPage(song.id, null)}
						onClick={() => openSong(song)}
						onKeyDown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								openSong(song);
							}
						}}
					>
						<span className="track-list-num">{song.discNumber > 1 ? `${song.discNumber}-` : ''}{song.trackNumber}</span>
						<span className="track-list-title">{song.title}</span>
						<span className="track-list-duration">{song.duration}</span>
						{playerPoolType && (
							<PlayButton
								type={playerPoolType}
								id={playerPoolId}
								slug={playerPoolSlug}
								startSongId={song.id}
								sourceLabel={playerSourceLabel}
								iconOnly
								className="track-list-play"
								label={`Play ${song.title}`}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}
