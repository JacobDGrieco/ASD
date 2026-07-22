/**
 * Global SoundCloud-backed player state for public music playback.
 *
 * `PlayerProvider` owns the current pool, queue order, shuffle history, loop mode,
 * widget/fullscreen UI state, SoundCloud iframe control, and prefetching of current
 * and upcoming song pages. It intentionally pauses on `/admin/*` routes so CMS work
 * does not keep public playback running in the background.
 *
 * The provider is mounted once in `src/App.jsx`; playback controls consume it via
 * `usePlayer()` from `playerContextCore.jsx`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation } from 'react-router-dom';
import SoundCloudPlayer from '../components/shared/SoundCloudPlayer.jsx';
import PlayerFullScreen from '../components/player/PlayerFullScreen.jsx';
import PlayerWidget from '../components/player/PlayerWidget.jsx';
import { prefetchApi } from './apiCache.js';
import { PlayerContext } from './playerContextCore.jsx';

function identityOrder(pool) {
	return pool.map((_, index) => index);
}

function shuffled(values) {
	const next = [...values];
	for (let index = next.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1))
			;[next[index], next[swapIndex]] = [next[swapIndex], next[index]];
	}
	return next;
}

function randomPoolIndex(pool) {
	return Math.floor(Math.random() * pool.length);
}

// Shuffle order keeps already-played indexes at the front so "previous" can walk
// through real listener history instead of re-randomizing the queue.
function buildShuffleOrder(pool, currentIndex, history = []) {
	const played = new Set([...history, currentIndex]);
	const remaining = identityOrder(pool).filter((index) => !played.has(index));
	return [...history, currentIndex, ...shuffled(remaining)];
}

// Broadcasts a site-wide pause request that embedded media players listen for.
// The hidden SoundCloud iframe owned here opts out to avoid pausing itself.
function pauseExternalAudio() {
	window.dispatchEvent(new Event('asd-player-pause-external-audio'));
}

export function PlayerProvider({ children }) {
	const location = useLocation();
	const soundCloudRef = useRef(null);
	const [pool, setPool] = useState([]);
	const [poolSourceLabel, setPoolSourceLabel] = useState('');
	const [currentIndex, setCurrentIndex] = useState(0);
	const [playOrder, setPlayOrder] = useState([]);
	const [isShuffled, setIsShuffled] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [position, setPosition] = useState(0);
	const [duration, setDuration] = useState(0);
	const [history, setHistory] = useState([]);
	const [isWidgetVisible, setIsWidgetVisible] = useState(false);
	const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
	const [playerError, setPlayerError] = useState('');
	const [playerSessionKey, setPlayerSessionKey] = useState(0);
	const [loopMode, setLoopMode] = useState('off');

	const isAdminPath = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
	const currentSong = pool[currentIndex] ?? null;

	useEffect(() => {
		if (isAdminPath) setIsPlaying(false);
	}, [isAdminPath]);

	useEffect(() => {
		setPosition(0);
		setDuration(0);
		setPlayerError('');
	}, [currentSong?.id]);

	useEffect(() => {
		if (isAdminPath || !isWidgetVisible || !currentSong?.id || !pool.length) return undefined;

		let cancelled = false;
		const timeoutIds = [];
		const order = playOrder.length ? playOrder : identityOrder(pool);
		const cursor = order.indexOf(currentIndex);
		const orderedIndexes = (cursor === -1 ? order : order.slice(cursor + 1)).concat(order);
		const preloadIds = orderedIndexes
			.map((index) => pool[index]?.id)
			.filter((id, index, ids) => id && id !== currentSong.id && ids.indexOf(id) === index);

		prefetchApi(`/api/songs/${currentSong.id}`).catch(() => { });

		const preloadUpcoming = () => {
			preloadIds.forEach((songId, index) => {
				const timeoutId = window.setTimeout(() => {
					if (!cancelled) {
						prefetchApi(`/api/songs/${songId}`).catch(() => { });
					}
				}, index * 120);
				timeoutIds.push(timeoutId);
			});
		};

		const idleId = 'requestIdleCallback' in window
			? window.requestIdleCallback(preloadUpcoming, { timeout: 1200 })
			: window.setTimeout(preloadUpcoming, 250);

		return () => {
			cancelled = true;
			timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
			if ('cancelIdleCallback' in window && typeof idleId === 'number') {
				window.cancelIdleCallback(idleId);
			} else {
				window.clearTimeout(idleId);
			}
		};
	}, [currentIndex, currentSong?.id, isAdminPath, isWidgetVisible, playOrder, pool]);

	/**
	 * Starts playback from a server-built player pool.
	 *
	 * Returns `false` for empty/invalid pools so buttons can report an empty state.
	 * `startIndex` is clamped because player-pool responses may come from cached or
	 * user-controlled contexts, while `shuffle` can choose a random first track.
	 */
	const playPool = useCallback((nextPool, { startIndex = null, source = '', shuffle = false } = {}) => {
		if (!Array.isArray(nextPool) || nextPool.length === 0) return false;

		const hasStartIndex = Number.isInteger(startIndex);
		const safeStartIndex = hasStartIndex
			? Math.min(Math.max(startIndex, 0), nextPool.length - 1)
			: shuffle
				? randomPoolIndex(nextPool)
				: 0;
		const nextHistory = [];
		const nextOrder = shuffle
			? buildShuffleOrder(nextPool, safeStartIndex, nextHistory)
			: identityOrder(nextPool);

		soundCloudRef.current?.pause();
		pauseExternalAudio();
		setPlayerSessionKey((previous) => previous + 1);
		setPool(nextPool);
		setPoolSourceLabel(source);
		setCurrentIndex(safeStartIndex);
		setPlayOrder(nextOrder);
		setIsShuffled(shuffle);
		setHistory(nextHistory);
		setPosition(0);
		setDuration(0);
		setPlayerError('');
		setIsWidgetVisible(true);
		setIsPlaying(!isAdminPath);
		return true;
	}, [isAdminPath]);

	const seekTo = useCallback((seconds) => {
		const nextSeconds = Math.max(0, Number(seconds) || 0);
		soundCloudRef.current?.seekTo(nextSeconds);
		setPosition(nextSeconds);
	}, []);

	const next = useCallback(({ fromFinish = false } = {}) => {
		if (!pool.length || currentIndex < 0) return;

		// Loop-one restarts the current SoundCloud embed instead of advancing the
		// queue when playback ends naturally.
		if (fromFinish && loopMode === 'one') {
			soundCloudRef.current?.seekTo(0);
			setPosition(0);
			setIsPlaying(true);
			return;
		}

		const order = playOrder.length ? playOrder : identityOrder(pool);
		const cursor = order.indexOf(currentIndex);
		let nextIndex = cursor === -1 ? currentIndex + 1 : order[cursor + 1];

		if (typeof nextIndex !== 'number') {
			if (loopMode === 'all' && order.length > 0) {
				nextIndex = order[0];
			} else {
				setIsPlaying(false);
				return;
			}
		}

		setHistory((previous) => [...previous, currentIndex]);
		setCurrentIndex(nextIndex);
		setPosition(0);
		setIsPlaying(true);
		pauseExternalAudio();
	}, [currentIndex, loopMode, playOrder, pool]);

	const prev = useCallback(() => {
		if (!pool.length || currentIndex < 0) return;

		// Match common media-player behavior: after a few seconds, "previous" means
		// restart the current track rather than jump to the previous history item.
		if (position > 3) {
			seekTo(0);
			return;
		}

		const previousIndex = history[history.length - 1];
		if (typeof previousIndex !== 'number') {
			seekTo(0);
			return;
		}

		setHistory((previous) => previous.slice(0, -1));
		setCurrentIndex(previousIndex);
		setPosition(0);
		setIsPlaying(true);
		pauseExternalAudio();
	}, [currentIndex, history, pool.length, position, seekTo]);

	const playPause = useCallback(() => {
		if (!currentSong) return;
		setIsPlaying((currentlyPlaying) => {
			const nextPlaying = !currentlyPlaying;
			if (nextPlaying) pauseExternalAudio();
			return nextPlaying;
		});
		setIsWidgetVisible(true);
	}, [currentSong]);

	const toggleShuffle = useCallback(() => {
		if (!pool.length) return;

		setIsShuffled((currentlyShuffled) => {
			const nextShuffled = !currentlyShuffled;
			setPlayOrder(nextShuffled ? buildShuffleOrder(pool, currentIndex, history) : identityOrder(pool));
			return nextShuffled;
		});
	}, [currentIndex, history, pool]);

	const toggleLoopMode = useCallback(() => {
		setLoopMode((currentMode) => {
			if (currentMode === 'off') return 'all';
			if (currentMode === 'all') return 'one';
			return 'off';
		});
	}, []);

	const jumpTo = useCallback((poolIndex) => {
		const nextIndex = Number(poolIndex);
		if (!pool[nextIndex]) return;

		if (nextIndex !== currentIndex) {
			setHistory((previous) => [...previous, currentIndex]);
		}

		setCurrentIndex(nextIndex);
		setPosition(0);
		setIsPlaying(true);
		setIsWidgetVisible(true);
		pauseExternalAudio();
	}, [currentIndex, pool]);

	const runPlayerViewTransition = useCallback((direction, update) => {
		if (
			typeof document === 'undefined' ||
			typeof document.startViewTransition !== 'function' ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			update();
			return;
		}

		// CSS in ViewTransitions.css keys off this transient dataset value to choose
		// open vs. close animations for the full-screen player.
		const root = document.documentElement;
		root.dataset.playerTransition = direction;

		const transition = document.startViewTransition(() => {
			flushSync(update);
		});

		transition.finished.finally(() => {
			if (root.dataset.playerTransition === direction) {
				delete root.dataset.playerTransition;
			}
		});
	}, []);

	const openFullScreen = useCallback(() => {
		runPlayerViewTransition('open', () => setIsFullScreenOpen(true));
	}, [runPlayerViewTransition]);

	const closeFullScreen = useCallback(() => {
		runPlayerViewTransition('close', () => setIsFullScreenOpen(false));
	}, [runPlayerViewTransition]);

	const resetPlayer = useCallback(() => {
		soundCloudRef.current?.pause();
		setIsPlaying(false);
		setIsWidgetVisible(false);
		setIsFullScreenOpen(false);
		setPool([]);
		setPoolSourceLabel('');
		setCurrentIndex(0);
		setPlayOrder([]);
		setHistory([]);
		setPosition(0);
		setDuration(0);
		setPlayerError('');
		setPlayerSessionKey(0);
		setLoopMode('off');
	}, []);

	const dismiss = useCallback(() => {
		if (location.pathname === '/music' && !isFullScreenOpen) {
			// The music homepage can intercept dismissal to animate the mini player
			// back into its hero iPod before the shared player state is reset.
			const handled = !window.dispatchEvent(new CustomEvent('asd-player-home-return', {
				cancelable: true,
				detail: { resetPlayer },
			}));
			if (!handled) resetPlayer();
			return;
		}

		resetPlayer();
	}, [isFullScreenOpen, location.pathname, resetPlayer]);

	const value = useMemo(() => ({
		pool,
		poolSourceLabel,
		currentIndex,
		currentSong,
		playOrder: playOrder.length ? playOrder : identityOrder(pool),
		isShuffled,
		isPlaying,
		position,
		duration,
		history,
		isWidgetVisible,
		isFullScreenOpen,
		playerError,
		loopMode,
		playPool,
		playPause,
		next,
		prev,
		seekTo,
		toggleShuffle,
		toggleLoopMode,
		jumpTo,
		openFullScreen,
		closeFullScreen,
		dismiss,
	}), [
		closeFullScreen,
		currentIndex,
		currentSong,
		dismiss,
		duration,
		history,
		isFullScreenOpen,
		isPlaying,
		isShuffled,
		isWidgetVisible,
		jumpTo,
		loopMode,
		next,
		openFullScreen,
		playOrder,
		playPause,
		playPool,
		playerError,
		pool,
		poolSourceLabel,
		position,
		prev,
		seekTo,
		toggleLoopMode,
		toggleShuffle,
	]);

	return (
		<PlayerContext.Provider value={value}>
			{children}
			{currentSong?.soundcloudUrl && (
				<SoundCloudPlayer
					ref={soundCloudRef}
					url={currentSong.soundcloudUrl}
					hidden
					isPlaying={isPlaying}
					autoPlayOnReady={isPlaying}
					restartToken={playerSessionKey}
					respondsToGlobalPause={false}
					onReady={({ duration: nextDuration }) => setDuration(nextDuration || 0)}
					onPlaybackProgress={({ position: nextPosition, duration: nextDuration }) => {
						setPosition(nextPosition || 0);
						if (nextDuration) setDuration(nextDuration);
					}}
					onPlaybackEnd={() => next({ fromFinish: true })}
					onWidgetApiError={() => {
						setPlayerError("Couldn't load this track");
						setIsPlaying(false);
					}}
				/>
			)}
			{!isAdminPath && isWidgetVisible && !isFullScreenOpen && pool.length > 0 && <PlayerWidget />}
			{!isAdminPath && isFullScreenOpen && pool.length > 0 && <PlayerFullScreen />}
		</PlayerContext.Provider>
	);
}
