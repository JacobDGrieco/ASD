import { useMemo } from 'react';
import AlbumCard from '../components/artist/AlbumCard.jsx';
import AuroraBackground from '../components/shared/AuroraBackground.jsx';
import { prefetchApi, useApi } from '../hooks/useApi.js';
import { buildAlbumPath, buildSongPath } from '../lib/publicVisibility.js';
import '../styles/ShelfPage.css';

void prefetchApi('/api/artists');

function compareRecentAlbums(left, right) {
	return new Date(right.releaseDate).getTime() - new Date(left.releaseDate).getTime();
}

export default function ShelfPage() {
	const artistApiUrl = '/api/artists';
	const { data: artists, loading, error } = useApi(artistApiUrl, {
		refreshAtUtcMidnight: true,
	});

	const albums = useMemo(() => {
		return (artists ?? [])
			.flatMap((artist) =>
				(artist.albums ?? []).map((album) => ({
					...album,
					artist,
				}))
			)
			.sort(compareRecentAlbums);
	}, [artists]);

	return (
		<div className="page aurora-page shelf-page">
			<AuroraBackground />
			<div className="aurora-page-content shelf-page-shell">
				<header className="shelf-page-header">
					<p className="shelf-page-eyebrow">A.S.D. archive</p>
					<h1 className="shelf-page-title">The Shelf</h1>
					<p className="shelf-page-copy">Every public release in one place, ordered from newest to oldest.</p>
				</header>

				{error && !artists ? (
					<section className="shelf-page-status" role="alert">
						<p className="shelf-page-eyebrow">Shelf unavailable</p>
						<h2>We could not load the albums.</h2>
						<p className="shelf-page-detail">Request failed with: {error}</p>
					</section>
				) : albums.length > 0 ? (
					<section className="shelf-page-grid" aria-label="Albums ordered by most recent">
						{albums.map((album) => {
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
					</section>
				) : loading ? (
					<section className="shelf-page-grid shelf-page-grid-loading" aria-hidden="true">
						{Array.from({ length: 12 }, (_, index) => (
							<div key={index} className="shelf-page-album-placeholder" />
						))}
					</section>
				) : (
					<section className="shelf-page-status">
						<p className="shelf-page-eyebrow">Nothing shelved yet</p>
						<h2>Albums will appear here once public releases are available.</h2>
					</section>
				)}
			</div>
		</div>
	);
}
