import { lazy, Suspense } from 'react';
import { useApi } from '../../hooks/useApi.js';
import '../../styles/ArtistSplash.css';
import '../../styles/HomePortal.css';

const SilkBackground = lazy(() => import('../shared/SilkBackground.jsx'));

export default function MusicHomePreview() {
	const { data: artists } = useApi('/api/artists');
	const visibleArtists = (artists ?? []).filter((a) => a.isPubliclyVisible !== false);

	return (
		<div className="portal-preview portal-preview-music" aria-hidden="true">
			<div className="portal-live-preview">
				<div className="portal-live-preview-inner">
					<section className="artist-splash-splash">
						<Suspense fallback={<div className="artist-splash-silk" aria-hidden="true" />}>
							<SilkBackground />
						</Suspense>
						<div className="artist-splash-overlay" />
						<div className="artist-splash-rail">
							<div className="artist-splash-rail-window portal-rail-window">
								<div className="artist-splash-grid">
									{visibleArtists.slice(0, 8).map((artist, index) => (
										<div
											key={artist.id}
											className="artist-splash-card"
											style={{ '--artist-splash-enter-delay': `${index * 120}ms` }}
										>
											<span className="artist-splash-name-art" data-text={artist.name}>
												<span className="artist-splash-name-outline">{artist.name}</span>
											</span>
											<div className="artist-splash-card-frame">
												<div className="artist-splash-card-image-window">
													{artist.portrait && (
														<img
															src={artist.portrait}
															alt={artist.name}
															className="artist-splash-portrait artist-splash-portrait-current"
															loading={index < 3 ? 'eager' : 'lazy'}
															decoding="async"
														/>
													)}
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
