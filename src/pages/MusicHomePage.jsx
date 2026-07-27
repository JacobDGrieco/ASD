/**
 * Public music landing route.
 *
 * Coordinates the animated hero/player handoff, featured release previews, and
 * prefetching for the broader music section.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { FaPlay } from 'react-icons/fa';
import { prefetchApi, useApi } from '../hooks/useApi.js';
import ArtistSplash from '../components/home/ArtistSplash.jsx';
import RecordPlayer from '../components/home/RecordPlayer.jsx';
import AlbumCard from '../components/artist/AlbumCard.jsx';
import PlayerIpod from '../components/player/PlayerIpod.jsx';
import { preloadSoundCloudWidgetApi } from '../components/shared/SoundCloudPlayer.jsx';
import AuroraBackground from '../components/shared/AuroraBackground.jsx';
import { useAdminAuth } from '../lib/adminAuth.jsx';
import { usePlayer } from '../lib/playerContextCore.jsx';
import { cancelIdleWork, prefetchPlayerPool, scheduleIdleWork } from '../lib/publicPrefetch.js';
import { buildAlbumPath, buildSongPath } from '../lib/publicVisibility.js';
import { isAdminPreviewSession } from '../lib/publicPreview.js';
import '../styles/MusicHomePage.css';

void prefetchApi('/api/public?resource=musicHome');
void prefetchApi('/api/record-player');
void prefetchApi('/api/crosshair');

const HOME_LATEST_LIMIT = 8;
const HOME_CROSSHAIR_LIMIT = 2;
const HOME_IPOD_FLIGHT_MS = 620;

function getHomePageApiMessage(isDev) {
	if (isDev) {
		return 'The frontend dev server is up, but the API is not reachable. Start `npm run dev:vercel` in another terminal so `/api` can proxy to the local Vercel functions on port 3000, or use `npm run dev:vercel` by itself.';
	}

	return 'The frontend loaded, but the site could not reach its API routes. This usually means the deployment is missing environment variables, database access, or a failing serverless function.';
}

function HomeHeroPlaceholder() {
	return (
		<section className="home-shell home-shell-hero" aria-hidden="true">
			<div className="home-shell-overlay" />
			<div className="home-shell-artist-row">
				{Array.from({ length: 5 }, (_, index) => (
					<div key={index} className="home-shell-artist-card" />
				))}
			</div>
		</section>
	);
}

function HomeRecordPlayerPlaceholder() {
	return (
		<section className="home-shell home-shell-record-player" aria-hidden="true">
			<div className="home-shell-record-player-inner">
				<div className="home-shell-turntable" />
				<div className="home-shell-rack">
					{Array.from({ length: 8 }, (_, index) => (
						<div key={index} className="home-shell-record" />
					))}
				</div>
			</div>
		</section>
	);
}

function formatDate(value) {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function bottomRightPlayerRect(sourceRect) {
	const isCompact = window.matchMedia('(max-width: 820px)').matches;
	const width = isCompact ? 168 : 190;
	const inset = isCompact ? 14 : 22;
	const scale = width / sourceRect.width;
	const height = sourceRect.height * scale;
	return {
		left: window.innerWidth - inset - width,
		top: window.innerHeight - inset - height,
		width,
		height,
	};
}

function waitForNextFrame() {
	return new Promise((resolve) => {
		window.requestAnimationFrame(() => resolve());
	});
}

function createIdleFlightScreen() {
	const idleScreen = document.createElement('span');
	idleScreen.className = 'home-ipod-flight-screen-next player-widget-art player-widget-art-empty home-ipod-idle-screen';

	const title = document.createElement('strong');
	title.textContent = 'Shuffle';

	const detail = document.createElement('span');
	detail.textContent = 'all songs on A.S.D.';

	idleScreen.append(title, detail);
	return idleScreen;
}

function createSongFlightScreen(song) {
	const screen = document.createElement('span');
	screen.className = 'home-ipod-flight-screen-next home-ipod-flight-song-screen';

	if (song?.artworkUrl) {
		const artwork = document.createElement('img');
		artwork.src = song.artworkUrl;
		artwork.alt = '';
		artwork.className = 'player-widget-art';
		screen.appendChild(artwork);
	} else {
		const artworkFallback = document.createElement('span');
		artworkFallback.className = 'player-widget-art player-widget-art-empty';
		screen.appendChild(artworkFallback);
	}

	const title = document.createElement('span');
	title.className = 'player-widget-title';

	const titleText = document.createElement('span');
	titleText.className = 'player-widget-title-text';
	titleText.textContent = song?.title || 'A.S.D.';

	title.appendChild(titleText);
	screen.appendChild(title);

	return screen;
}

function installIpodFlightScreen(clone, nextScreen) {
	if (!nextScreen) return;

	const screen = clone.querySelector('.player-widget-screen');
	if (!screen) return;

	clone.classList.add('home-ipod-flight-crossfade');
	screen.appendChild(nextScreen);
}

async function animateIpodFlight(sourceElement, targetRect, { onArrive = null, nextScreen = null } = {}) {
	if (!sourceElement || !targetRect) return;
	const sourceRect = sourceElement.getBoundingClientRect();
	if (!sourceRect.width || !sourceRect.height) return;

	const clone = sourceElement.cloneNode(true);
	clone.classList.add('home-ipod-flight');
	installIpodFlightScreen(clone, nextScreen);
	clone.setAttribute('aria-hidden', 'true');
	clone.querySelectorAll('button').forEach((button) => {
		button.setAttribute('tabindex', '-1');
		button.disabled = true;
	});
	Object.assign(clone.style, {
		position: 'fixed',
		top: `${sourceRect.top}px`,
		left: `${sourceRect.left}px`,
		width: `${sourceRect.width}px`,
		height: `${sourceRect.height}px`,
		right: 'auto',
		bottom: 'auto',
		margin: '0',
		pointerEvents: 'none',
		transformOrigin: 'top left',
		zIndex: '240',
	});
	document.body.appendChild(clone);

	const deltaX = targetRect.left - sourceRect.left;
	const deltaY = targetRect.top - sourceRect.top;
	const scaleX = targetRect.width / sourceRect.width;
	const scaleY = targetRect.height / sourceRect.height;

	if (typeof clone.animate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		onArrive?.();
		clone.remove();
		return;
	}

	const animation = clone.animate([
		{ opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
		{ opacity: 1, transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})` },
	], {
		duration: HOME_IPOD_FLIGHT_MS,
		easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
		fill: 'both',
	});

	try {
		await animation.finished;
		animation.commitStyles?.();
		animation.cancel();
		onArrive?.();
		await waitForNextFrame();
	} finally {
		clone.remove();
	}
}

function HomeShuffleIpod() {
	const { currentSong, isPlaying, isWidgetVisible, playPause, playPool, extendPool } = usePlayer();
	const wrapRef = useRef(null);
	const [isLaunching, setIsLaunching] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');
	const isParkedInPlayer = Boolean(currentSong && isWidgetVisible);

	useEffect(() => {
		const idleId = scheduleIdleWork(() => {
			void preloadSoundCloudWidgetApi();
			void prefetchPlayerPool('/api/player-pool?type=sitewide&limit=30', { maxAge: 30 * 1000, artworkLimit: 8 }).catch(() => { });
		}, { timeout: 1800 });

		return () => cancelIdleWork(idleId);
	}, []);

	useEffect(() => {
		const handleReturn = async (event) => {
			const resetPlayer = event.detail?.resetPlayer;
			const sourceElement = document.querySelector('.player-widget:not(.home-ipod-player)');
			const targetElement = wrapRef.current?.querySelector('.home-ipod-player');
			if (typeof resetPlayer !== 'function' || !sourceElement || !targetElement) return;

			event.preventDefault();
			sourceElement.classList.add('player-widget-returning-home');
			try {
				await animateIpodFlight(sourceElement, targetElement.getBoundingClientRect(), {
					nextScreen: createIdleFlightScreen(),
					onArrive: () => flushSync(resetPlayer),
				});
			} finally {
				if (sourceElement.isConnected) {
					sourceElement.classList.remove('player-widget-returning-home');
				}
			}
		};

		window.addEventListener('asd-player-home-return', handleReturn);
		return () => window.removeEventListener('asd-player-home-return', handleReturn);
	}, []);

	const handlePlay = async () => {
		if (isLoading) return;
		if (currentSong) {
			playPause();
			return;
		}

		setIsLoading(true);
		setError('');

		try {
			void preloadSoundCloudWidgetApi();
			const data = await prefetchPlayerPool('/api/player-pool?type=sitewide&limit=30', { maxAge: 30 * 1000, artworkLimit: 8 });
			const pool = Array.isArray(data?.pool) ? data.pool : [];
			if (!pool.length) {
				setError('No streamable songs are available.');
				return;
			}

			const startIndex = Math.floor(Math.random() * pool.length);
			const nextSong = pool[startIndex];
			const sourceElement = wrapRef.current?.querySelector('.home-ipod-player');
			setIsLaunching(true);
			if (sourceElement) {
				await animateIpodFlight(sourceElement, bottomRightPlayerRect(sourceElement.getBoundingClientRect()), {
					nextScreen: createSongFlightScreen(nextSong),
					onArrive: () => flushSync(() => {
						playPool(pool, {
							startIndex,
							source: data?.sourceLabel || 'Playing from A.S.D.',
							shuffle: true,
						});
					}),
				});
			} else {
				playPool(pool, {
					startIndex,
					source: data?.sourceLabel || 'Playing from A.S.D.',
					shuffle: true,
				});
			}

			if (data?.hasMore && Number.isFinite(Number(data.nextOffset))) {
				prefetchPlayerPool(`/api/player-pool?type=sitewide&limit=1000&offset=${data.nextOffset}`, { maxAge: 30 * 1000, artworkLimit: 0 })
					.then((nextData) => {
						if (Array.isArray(nextData?.pool)) extendPool(nextData.pool);
					})
					.catch(() => { });
			}
		} catch {
			setError('Shuffle unavailable.');
		} finally {
			setIsLaunching(false);
			setIsLoading(false);
		}
	};

	return (
		<div ref={wrapRef} className={`home-ipod-wrap ${isParkedInPlayer ? 'home-ipod-wrap-player-active' : ''}`.trim()}>
			<PlayerIpod
				className={`home-ipod-player ${isLaunching ? 'home-ipod-player-launching' : ''}`.trim()}
				isPlaying={isLoading || isPlaying}
				onClose={() => { }}
				onHubClick={handlePlay}
				onMenu={handlePlay}
				onNext={handlePlay}
				onPrev={handlePlay}
				onScreenClick={handlePlay}
				screenAriaLabel={currentSong ? 'Play or pause' : 'Shuffle all songs'}
				screenContent={(
					<span className="player-widget-art player-widget-art-empty home-ipod-idle-screen">
						<strong>{isLoading ? 'Loading' : 'Shuffle'}</strong>
						<span>all songs on A.S.D.</span>
					</span>
				)}
			/>
			<p className="home-ipod-instruction">{error || 'Press play to shuffle every streamable song on the site.'}</p>
		</div>
	);
}

export default function MusicHomePage() {
	const location = useLocation();
	const { session, token } = useAdminAuth();
	const adminPreview = isAdminPreviewSession(session, token);
	const musicHomeApiUrl = '/api/public?resource=musicHome';
	const recordApiUrl = '/api/record-player';
	const crosshairApiUrl = '/api/crosshair';
	const {
		data: musicHome,
		loading: musicHomeLoading,
		error: musicHomeError,
	} = useApi(musicHomeApiUrl, {
		refreshAtUtcMidnight: true,
	});
	const {
		data: tracks,
		loading: tracksLoading,
		error: tracksError,
	} = useApi(recordApiUrl, {
		refreshAtUtcMidnight: true,
	});
	const {
		data: crosshairVideos,
		loading: crosshairLoading,
		error: crosshairError,
	} = useApi(crosshairApiUrl, {
		refreshAtUtcMidnight: true,
	});
	const apiMessage = getHomePageApiMessage(import.meta.env.DEV);
	const skipHeroEntranceAnimation = location.state?.fromPortal === 'music';

	const artists = musicHome?.artists ?? [];
	const latestReleases = (musicHome?.latestReleases ?? []).slice(0, HOME_LATEST_LIMIT);

	const featuredCrosshairVideos = useMemo(() => (
		(Array.isArray(crosshairVideos) ? crosshairVideos : []).slice(0, HOME_CROSSHAIR_LIMIT)
	), [crosshairVideos]);

	if ((musicHomeError || tracksError) && !musicHome && !tracks) {
		return (
			<div className="page aurora-page">
				<AuroraBackground />
				<div className="aurora-page-content home-status">
					<div className="home-status__panel">
						<p className="home-status__eyebrow">Content unavailable</p>
						<h1>Local API requests failed.</h1>
						<p>{apiMessage}</p>
						<p className="home-status__detail">
							Music home request: {musicHomeError ?? 'ok'}
							<br />
							Record player request: {tracksError ?? 'ok'}
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="page aurora-page">
			<AuroraBackground />
			<div className="aurora-page-content home-page-content">
				<div className="home-stage">
					{artists?.length ? (
						<ArtistSplash artists={artists} skipEntranceAnimation={skipHeroEntranceAnimation} />
					) : musicHomeLoading ? <HomeHeroPlaceholder /> : null}
					{tracksLoading ? (
						<HomeRecordPlayerPlaceholder />
					) : (
						<RecordPlayer
							tracks={tracks ?? []}
							message={tracksError ? 'The home page could not load record-player tracks from the API.' : null}
							leadingAccessory={<HomeShuffleIpod />}
						/>
					)}
				</div>
				<section className="home-about">
					<div className="home-about-copy home-section-copy">
						<p className="home-about-kicker home-section-kicker">The Shelf</p>
						<h2 className="home-about-title home-section-title">Independent music from the underground.</h2>
						<p className="home-section-text">
							A.S.D. is an independent collective built around artists who move outside the expected lane.
							Each release is shaped with a hands-on approach, from early demos to the final visual world around it.
						</p>
						<p className="home-section-text">
							The catalog spans intimate singles, sharper experimental projects, and collaborative drops that keep the label rooted in its own scene instead of chasing a template.
						</p>
						<Link to="/shelf" className="home-about-link">Scan The Shelf</Link>
					</div>
					<div className="home-latest home-latest-inline">
						{latestReleases.length > 0 ? (
							<div className="home-latest-row" aria-label="Latest albums">
								{latestReleases.map((album) => {
									const singleSong = album.type === 'SINGLE' && album.songs?.length === 1 ? album.songs[0] : null;
									const to = singleSong
										? buildSongPath({ song: singleSong, allowHidden: adminPreview })
										: buildAlbumPath({ album, allowHidden: adminPreview });

									return (
										<AlbumCard
											key={album.id}
											album={album}
											subtitle={album.artist?.name}
											to={to}
										/>
									);
								})}
							</div>
						) : musicHomeLoading ? (
							<div className="home-latest-row home-latest-row-loading" aria-hidden="true">
								{Array.from({ length: HOME_LATEST_LIMIT }, (_, index) => (
									<div key={index} className="home-latest-card-placeholder" />
								))}
							</div>
						) : (
							<div className="home-latest-empty">Latest albums will appear here once public catalog data is available.</div>
						)}
					</div>
				</section>
				<section className="home-crosshair" aria-labelledby="home-crosshair-title">
					<div className="home-crosshair-copy home-section-copy">
						<p className="home-crosshair-kicker home-section-kicker">The Crosshair</p>
						<h2 id="home-crosshair-title" className="home-crosshair-title home-section-title">Sessions, shorts, and uncut footage.</h2>
						<p className="home-section-text">
							A closer view of the people around A.S.D., from raw conversations to edited drops and short-form pieces.
						</p>
						<Link to="/crosshair" className="home-crosshair-link">View The Crosshair</Link>
					</div>
					<div className="home-crosshair-videos" aria-label="Latest Crosshair videos">
						{featuredCrosshairVideos.map((video) => (
							<Link key={video.id} to="/crosshair" className="home-crosshair-card">
								<span className={`home-crosshair-thumb ${video.type === 'SHORT' ? 'home-crosshair-thumb-short' : ''}`.trim()}>
									<img src={video.thumbnailUrl || '/favicon.png'} alt="" loading="lazy" decoding="async" />
									<span className="home-crosshair-play"><FaPlay aria-hidden="true" /></span>
								</span>
								<span className="home-crosshair-card-body">
									<span className="home-crosshair-type">{video.typeLabel}</span>
									<strong>{video.title}</strong>
									<span>{formatDate(video.publishedAt) || 'A.S.D.'}</span>
								</span>
							</Link>
						))}
						{crosshairLoading && !featuredCrosshairVideos.length && (
							<div className="home-crosshair-loading" aria-hidden="true">
								<div />
								<div />
							</div>
						)}
						{!crosshairLoading && !featuredCrosshairVideos.length && (
							<div className="home-crosshair-empty">
								{crosshairError ? 'Crosshair videos could not be loaded.' : 'Crosshair videos will appear here once they are published.'}
							</div>
						)}
					</div>
				</section>
			</div>
		</div>
	);
}
