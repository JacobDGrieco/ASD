/**
 * Music-home turntable display.
 *
 * Connects visual playback state to the SoundCloud-backed player surface.
 */
import SoundCloudPlayer from '../shared/SoundCloudPlayer.jsx';
import '../../styles/Turntable.css';

export default function Turntable({
	activeTrack,
	isPlaying,
	autoPlayOnReady = false,
	onTonearmToggle,
	onPlaybackStart,
	onPlaybackPause,
	onPlaybackEnd,
}) {
	const coverArt = activeTrack?.song.album.coverArt ?? null;
	const title = activeTrack?.song.title ?? null;
	const artist = activeTrack?.song.album.artist.name ?? null;
	const scUrl = activeTrack?.song.soundcloudUrl ?? null;
	const canTogglePlayback = Boolean(scUrl);

	return (
		<div className="turntable-wrap">
			<div className="turntable-scene">
				<div className="turntable-body">
					<div className={`turntable-platter ${isPlaying ? 'turntable-spinning' : 'turntable-paused'}`}>
						{coverArt && (
							<img
								src={coverArt}
								alt={title ?? ''}
								className="turntable-label"
								loading="eager"
								fetchPriority="high"
								decoding="async"
							/>
						)}
						{!coverArt && <div className="turntable-label-blank" />}
					</div>
					<button
						type="button"
						className={`turntable-tonearm ${isPlaying ? 'turntable-playing' : ''}`}
						onClick={onTonearmToggle}
						disabled={!canTogglePlayback}
						aria-label={isPlaying ? 'Pause song' : 'Play song'}
						title={isPlaying ? 'Pause song' : 'Play song'}
					/>
				</div>
			</div>
			<div
				className={`turntable-now-playing ${title ? '' : 'turntable-now-playing-empty'}`.trim()}
				aria-label={title ? 'Now playing' : undefined}
				aria-live={title ? 'polite' : undefined}
				aria-hidden={title ? undefined : 'true'}
			>
				<span className="turntable-track-title">{title}</span>
				<span className="turntable-track-artist">{artist}</span>
			</div>
			{scUrl && (
				<div className="turntable-player">
					<SoundCloudPlayer
						url={scUrl}
						isPlaying={isPlaying}
						hidden
						autoPlayOnReady={autoPlayOnReady}
						onPlaybackStart={onPlaybackStart}
						onPlaybackPause={onPlaybackPause}
						onPlaybackEnd={onPlaybackEnd}
					/>
				</div>
			)}
		</div>
	);
}
