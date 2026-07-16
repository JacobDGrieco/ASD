import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FaPlay } from 'react-icons/fa';
import { prefetchApi, useApi } from '../hooks/useApi.js';
import ArtistSplash from '../components/home/ArtistSplash.jsx';
import RecordPlayer from '../components/home/RecordPlayer.jsx';
import AlbumCard from '../components/artist/AlbumCard.jsx';
import AuroraBackground from '../components/shared/AuroraBackground.jsx';
import { useAdminAuth } from '../lib/adminAuth.jsx';
import { buildAlbumPath, buildSongPath } from '../lib/publicVisibility.js';
import { isAdminPreviewSession } from '../lib/publicPreview.js';
import '../styles/MusicHomePage.css';

void prefetchApi('/api/artists');
void prefetchApi('/api/record-player');
void prefetchApi('/api/crosshair');

const HOME_LATEST_LIMIT = 8;
const HOME_CROSSHAIR_LIMIT = 2;

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

export default function MusicHomePage() {
	const { session, token } = useAdminAuth();
	const adminPreview = isAdminPreviewSession(session, token);
	const artistApiUrl = '/api/artists';
	const recordApiUrl = '/api/record-player';
	const crosshairApiUrl = '/api/crosshair';
	const {
		data: artists,
		loading: artistsLoading,
		error: artistsError,
	} = useApi(artistApiUrl, {
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

	const latestReleases = useMemo(() => {
		return (artists ?? [])
			.flatMap((artist) =>
				(artist.albums ?? []).map((album) => ({
					...album,
					artist,
				}))
			)
			.sort((left, right) => new Date(right.releaseDate).getTime() - new Date(left.releaseDate).getTime())
			.slice(0, HOME_LATEST_LIMIT);
	}, [artists]);

	const featuredCrosshairVideos = useMemo(() => (
		(Array.isArray(crosshairVideos) ? crosshairVideos : []).slice(0, HOME_CROSSHAIR_LIMIT)
	), [crosshairVideos]);

	if ((artistsError || tracksError) && !artists && !tracks) {
		return (
			<div className="page aurora-page">
				<AuroraBackground />
				<div className="aurora-page-content home-status">
					<div className="home-status__panel">
						<p className="home-status__eyebrow">Content unavailable</p>
						<h1>Local API requests failed.</h1>
						<p>{apiMessage}</p>
						<p className="home-status__detail">
							Artists request: {artistsError ?? 'ok'}
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
					{artists?.length ? <ArtistSplash artists={artists} /> : artistsLoading ? <HomeHeroPlaceholder /> : null}
					{tracksLoading ? (
						<HomeRecordPlayerPlaceholder />
					) : (
						<RecordPlayer
							tracks={tracks ?? []}
							message={tracksError ? 'The home page could not load record-player tracks from the API.' : null}
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
						) : artistsLoading ? (
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
