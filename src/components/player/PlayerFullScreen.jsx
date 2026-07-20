import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
	FaCompressAlt,
	FaListUl,
	FaPause,
	FaPlay,
	FaRandom,
	FaRedoAlt,
	FaRegCommentDots,
	FaStepBackward,
	FaStepForward,
} from 'react-icons/fa';
import { usePlayer } from '../../lib/playerContextCore.jsx';
import PlayerLyricsPanel from './PlayerLyricsPanel.jsx';
import PlayerQueuePanel from './PlayerQueuePanel.jsx';

function formatTime(seconds) {
	const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
	const minutes = Math.floor(safeSeconds / 60);
	const remainingSeconds = String(safeSeconds % 60).padStart(2, '0');
	return `${minutes}:${remainingSeconds}`;
}

function shouldShowAlbum(song) {
	return song.albumType && song.albumType !== 'SINGLE' && song.albumTitle;
}

function PlayerCopyLink({ children, className = '', onNavigate, to }) {
	if (!to) return <span className={className}>{children}</span>;

	return (
		<Link to={to} className={className} onClick={onNavigate}>
			{children}
		</Link>
	);
}

export default function PlayerFullScreen() {
	const {
		closeFullScreen,
		currentSong,
		duration,
		isPlaying,
		isShuffled,
		loopMode,
		next,
		playPause,
		poolSourceLabel,
		position,
		prev,
		seekTo,
		toggleLoopMode,
		toggleShuffle,
		playerError,
	} = usePlayer();
	const [panel, setPanel] = useState('lyrics');

	useEffect(() => {
		const scrollY = window.scrollY;
		const previousPosition = document.body.style.position;
		const previousTop = document.body.style.top;
		const previousLeft = document.body.style.left;
		const previousRight = document.body.style.right;
		const previousWidth = document.body.style.width;
		const previousOverflow = document.body.style.overflow;

		document.body.style.position = 'fixed';
		document.body.style.top = `-${scrollY}px`;
		document.body.style.left = '0';
		document.body.style.right = '0';
		document.body.style.width = '100%';
		document.body.style.overflow = 'hidden';

		return () => {
			document.body.style.position = previousPosition;
			document.body.style.top = previousTop;
			document.body.style.left = previousLeft;
			document.body.style.right = previousRight;
			document.body.style.width = previousWidth;
			document.body.style.overflow = previousOverflow;
			window.scrollTo(0, scrollY);
		};
	}, []);

	if (!currentSong) return null;

	const maxDuration = Math.max(duration || 0, position || 0, 1);
	const artistName = currentSong.artistName || 'A.S.D.';
	const artistPath = currentSong.artistSlug ? `/artists/${currentSong.artistSlug}` : null;
	const albumPath = currentSong.albumPath || (currentSong.albumId ? `/albums/${currentSong.albumId}` : null);
	const songPath = currentSong.songPath || (currentSong.id ? `/songs/${currentSong.id}` : null);
	const showAlbum = shouldShowAlbum(currentSong);

	return createPortal(
		<div className="player-fullscreen" role="dialog" aria-modal="true" aria-label="Music player">
			<button type="button" className="player-fullscreen-collapse" onClick={closeFullScreen} aria-label="Collapse player">
				<FaCompressAlt aria-hidden="true" size="2em" />
			</button>
			<div className="player-fullscreen-left">
				<p className="player-fullscreen-source">{poolSourceLabel || 'Playing from A.S.D.'}</p>
				<div className="player-fullscreen-art-wrap">
					{currentSong.artworkUrl ? (
						<img src={currentSong.artworkUrl} alt="" className="player-fullscreen-art" />
					) : (
						<div className="player-fullscreen-art-empty" aria-hidden="true" />
					)}
				</div>
				<div className="player-fullscreen-copy">
					<h2>
						<PlayerCopyLink to={songPath} onNavigate={closeFullScreen}>
							{currentSong.title}
						</PlayerCopyLink>
					</h2>
					{playerError ? (
						<p>{playerError}</p>
					) : (
						<p className="player-fullscreen-meta">
							<PlayerCopyLink to={artistPath} onNavigate={closeFullScreen}>
								{artistName}
							</PlayerCopyLink>
							{showAlbum && (
								<>
									<span className="player-fullscreen-meta-separator">-</span>
									<PlayerCopyLink to={albumPath} onNavigate={closeFullScreen}>
										{currentSong.albumTitle}
									</PlayerCopyLink>
								</>
							)}
						</p>
					)}
				</div>
				<div className="player-progress">
					<input
						type="range"
						min="0"
						max={maxDuration}
						step="1"
						value={Math.min(position, maxDuration)}
						onChange={(event) => seekTo(Number(event.target.value))}
						aria-label="Playback position"
					/>
					<div className="player-progress-time">
						<span>{formatTime(position)}</span>
						<span>{formatTime(duration)}</span>
					</div>
				</div>
				<div className="player-fullscreen-transport">
					<button
						type="button"
						className={isShuffled ? 'player-control-active' : ''}
						onClick={toggleShuffle}
						aria-label="Shuffle"
						title="Shuffle"
					>
						<FaRandom aria-hidden="true" />
					</button>
					<button type="button" onClick={prev} aria-label="Previous track">
						<FaStepBackward aria-hidden="true" />
					</button>
					<button type="button" className="player-fullscreen-play" onClick={playPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
						{isPlaying ? <FaPause aria-hidden="true" /> : <FaPlay aria-hidden="true" />}
					</button>
					<button type="button" onClick={() => next()} aria-label="Next track">
						<FaStepForward aria-hidden="true" />
					</button>
					<button
						type="button"
						className={loopMode !== 'off' ? 'player-control-active player-loop-control' : 'player-loop-control'}
						onClick={toggleLoopMode}
						aria-label={loopMode === 'one' ? 'Loop one' : loopMode === 'all' ? 'Loop all' : 'Loop off'}
						title={loopMode === 'one' ? 'Loop one' : loopMode === 'all' ? 'Loop all' : 'Loop off'}
						data-loop-mode={loopMode}
					>
						<FaRedoAlt aria-hidden="true" />
						{loopMode === 'one' && <span aria-hidden="true">1</span>}
					</button>
				</div>
				<div className="player-fullscreen-toggles" aria-label="Player panels">
					<button
						type="button"
						className={panel === 'lyrics' ? 'player-toggle-active' : ''}
						onClick={() => setPanel('lyrics')}
						aria-label="Lyrics"
						title="Lyrics"
					>
						<FaRegCommentDots aria-hidden="true" />
					</button>
					<button
						type="button"
						className={panel === 'queue' ? 'player-toggle-active' : ''}
						onClick={() => setPanel('queue')}
						aria-label="Queue"
						title="Queue"
					>
						<FaListUl aria-hidden="true" />
					</button>
				</div>
			</div>
			<div className="player-fullscreen-right">
				{panel === 'queue' ? <PlayerQueuePanel /> : <PlayerLyricsPanel song={currentSong} />}
			</div>
		</div>,
		document.body,
	);
}
