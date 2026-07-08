import { lazy, Suspense } from 'react';
import { useApi } from '../../hooks/useApi.js';
import '../../styles/ArtistSplash.css';
import '../../styles/HomePortal.css';

const SilkBackground = lazy(() => import('../shared/SilkBackground.jsx'));

export default function MusicHomePreview() {
	const { data: artists } = useApi('/api/artists');
	const visibleArtists = (artists ?? []).filter((a) => a.isPubliclyVisible !== false);
	const previewArtists = visibleArtists.slice(0, 8);
	const rowCount = previewArtists.length >= 5 ? 2 : 1;
	const columnCount = Math.max(1, Math.ceil(previewArtists.length / rowCount));
	const cardMaxWidth = rowCount === 2 ? 280 : 320;
	const cardHeightLimit = rowCount === 2 ? '27dvh' : '48dvh';
	const totalGap = Math.max(0, columnCount - 1) * 20;
	const wideColumnCount = Math.max(1, previewArtists.length);
	const wideTotalGap = Math.max(0, wideColumnCount - 1) * 24;
	const gridStyle = {
		'--artist-splash-grid-columns': columnCount,
		'--artist-splash-grid-max': `${columnCount * cardMaxWidth + totalGap}px`,
		'--artist-splash-card-basis': `min(${cardMaxWidth}px, ${cardHeightLimit}, calc((100% - ${totalGap}px) / ${columnCount}))`,
		'--artist-splash-wide-grid-max': `${wideColumnCount * 340 + wideTotalGap}px`,
		'--artist-splash-wide-card-basis': `min(340px, 43dvh, calc((100% - ${wideTotalGap}px) / ${wideColumnCount}))`,
	};

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
								<div
									className="artist-splash-grid"
									style={gridStyle}
								>
									{previewArtists.map((artist, index) => (
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
