import { useMemo } from 'react';
import { prefetchApi, useApi } from '../hooks/useApi.js';
import ArtistSplash from '../components/home/ArtistSplash.jsx';
import RecordPlayer from '../components/home/RecordPlayer.jsx';
import AlbumCard from '../components/artist/AlbumCard.jsx';
import AuroraBackground from '../components/shared/AuroraBackground.jsx';
import { buildAlbumPath, buildSongPath } from '../lib/publicVisibility.js';
import { useAdminAuth } from '../lib/adminAuth.jsx';
import { isAdminPreviewSession, publicPreviewCacheKey, publicPreviewHeaders } from '../lib/publicPreview.js';
import '../styles/HomePage.css';

void prefetchApi('/api/artists');
void prefetchApi('/api/record-player');

export function getHomePageApiMessage(isDev) {
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
					{Array.from({ length: 6 }, (_, index) => (
						<div key={index} className="home-shell-record" />
					))}
				</div>
			</div>
		</section>
	);
}

export default function HomePage() {
	const { session, token } = useAdminAuth();
	const adminPreview = isAdminPreviewSession(session, token);
	const artistHeaders = useMemo(() => publicPreviewHeaders(adminPreview ? token : null), [adminPreview, token]);
	const artistApiUrl = '/api/artists';
	const recordApiUrl = '/api/record-player';
	const {
		data: artists,
		loading: artistsLoading,
		error: artistsError,
	} = useApi(artistApiUrl, {
		refreshAtUtcMidnight: true,
		headers: artistHeaders,
		cacheKey: publicPreviewCacheKey(artistApiUrl, adminPreview),
	});
	const {
		data: tracks,
		loading: tracksLoading,
		error: tracksError,
	} = useApi(recordApiUrl, {
		refreshAtUtcMidnight: true,
		headers: artistHeaders,
		cacheKey: publicPreviewCacheKey(recordApiUrl, adminPreview),
	});
	const apiMessage = getHomePageApiMessage(import.meta.env.DEV);

	const latestReleases = useMemo(() => {
		return (artists ?? [])
			.flatMap((artist) =>
				(artist.albums ?? []).map((album) => ({
					...album,
					artist: artist,
				}))
			)
			.sort((left, right) => new Date(right.releaseDate).getTime() - new Date(left.releaseDate).getTime())
			.slice(0, 6);
	}, [artists]);

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
					<div className="home-about-copy">
						<h2 className="home-about-title">Independent music from the underground.</h2>
						<p>
							ASD Records is an independent collective built around artists who move outside the expected lane.
							Each release is shaped with a hands-on approach, from early demos to the final visual world around it.
						</p>
						<p>
							The catalog spans intimate singles, sharper experimental projects, and collaborative drops that keep the label rooted in its own scene instead of chasing a template.
						</p>
					</div>
					<div className="home-latest home-latest-inline">
						{latestReleases.length > 0 ? (
							<div className="home-latest-row" aria-label="Latest releases">
								{latestReleases.map((album) => {
									const singleSong = album.songs?.length === 1 ? album.songs[0] : null;
									const leadSong = singleSong ?? album.songs?.[0] ?? null;
									const to = singleSong
										? buildSongPath({ song: singleSong, allowHidden: adminPreview })
										: buildAlbumPath({ album, allowHidden: adminPreview })
											?? buildSongPath({ song: leadSong, allowHidden: adminPreview });

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
								{Array.from({ length: 4 }, (_, index) => (
									<div key={index} className="home-latest-card-placeholder" />
								))}
							</div>
						) : (
							<div className="home-latest-empty">Latest releases will appear here once public catalog data is available.</div>
						)}
					</div>
				</section>
			</div>
		</div>
	);
}
