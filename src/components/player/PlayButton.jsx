/**
 * Shared play/pause button for song, album, artist, and record-player contexts.
 *
 * Fetches or receives a player pool and delegates playback state to `usePlayer`.
 */
import { useCallback, useMemo, useState } from 'react';
import { FaPlay, FaRandom } from 'react-icons/fa';
import { prefetchPlayerPool } from '../../lib/publicPrefetch.js';
import { usePlayer } from '../../lib/playerContextCore.jsx';
import { preloadSoundCloudWidgetApi } from '../shared/SoundCloudPlayer.jsx';

function playerPoolUrl({ type, id, slug }) {
	const params = new URLSearchParams({ type });
	if (id) params.set('id', id);
	if (slug) params.set('slug', slug);
	return `/api/player-pool?${params.toString()}`;
}

export default function PlayButton({
	type,
	id = '',
	slug = '',
	startSongId = '',
	sourceLabel = '',
	shuffle = false,
	label = shuffle ? 'Shuffle' : 'Play',
	className = '',
	iconOnly = false,
	disabled = false,
}) {
	const { playPool } = usePlayer();
	const [loading, setLoading] = useState(false);
	const [empty, setEmpty] = useState(false);
	const [error, setError] = useState('');
	const url = useMemo(() => playerPoolUrl({ type, id, slug }), [id, slug, type]);
	const isDisabled = disabled || loading || empty;
	const title = empty ? 'No streamable tracks' : error || label;

	const warmPlayer = useCallback(() => {
		if (disabled || empty) return;

		void preloadSoundCloudWidgetApi();
		void prefetchPlayerPool(url, { maxAge: 30 * 1000, artworkLimit: 5 }).catch(() => { });
	}, [disabled, empty, url]);

	const handleClick = async (event) => {
		event.preventDefault();
		event.stopPropagation();
		if (isDisabled) return;

		setLoading(true);
		setError('');

		try {
			void preloadSoundCloudWidgetApi();
			const data = await prefetchPlayerPool(url, { maxAge: 30 * 1000, artworkLimit: 5 });
			const pool = Array.isArray(data?.pool) ? data.pool : [];
			if (!pool.length) {
				setEmpty(true);
				return;
			}

			const requestedStartIndex = startSongId
				? Math.max(0, pool.findIndex((song) => song.id === startSongId))
				: Math.max(0, data?.startIndex ?? 0);
			const playOptions = {
				source: sourceLabel || data?.sourceLabel || '',
				shuffle,
			};
			if (!shuffle || startSongId) {
				playOptions.startIndex = requestedStartIndex;
			}

			playPool(pool, playOptions);
		} catch {
			setError('Player unavailable');
			window.setTimeout(() => setError(''), 2200);
		} finally {
			setLoading(false);
		}
	};

	return (
		<button
			type="button"
			className={`player-play-button ${iconOnly ? 'player-play-button-icon' : ''} ${className}`.trim()}
			onClick={handleClick}
			onMouseEnter={warmPlayer}
			onFocus={warmPlayer}
			onTouchStart={warmPlayer}
			disabled={isDisabled}
			title={title}
			aria-label={title}
			data-error={error ? 'true' : undefined}
		>
			{shuffle ? <FaRandom aria-hidden="true" /> : <FaPlay aria-hidden="true" />}
			{!iconOnly && <span>{loading ? 'Loading' : error || label}</span>}
		</button>
	);
}
