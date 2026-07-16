import { useApi } from '../../hooks/useApi.js';
import musicStageBackdrop from '../../assets/music-tour-stage-backdrop.png';
import '../../styles/ArtistSplash.css';
import '../../styles/HomePortal.css';

function ArtistPreviewCard({ artist, index, className = '', active = false }) {
	return (
		<div
			className={`artist-splash-card ${active ? 'artist-splash-card-active' : ''} ${artist.isPubliclyVisible === false ? 'artist-splash-card-hidden' : ''} ${className}`.trim()}
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
	);
}

function buildMobileSpotlightArtists(artists) {
	if (artists.length <= 1) {
		return {
			artists,
			activeIndex: 0,
		};
	}

	return {
		artists: [-2, -1, 0, 1, 2].map((offset) => artists[(offset + artists.length) % artists.length]),
		activeIndex: 2,
	};
}

export default function MusicHomePreview() {
	const { data: artists } = useApi('/api/artists');
	const previewArtists = (artists ?? []).slice(0, 8);
	const { artists: mobilePreviewArtists, activeIndex: activeMobileIndex } = buildMobileSpotlightArtists(previewArtists);
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
						<img src={musicStageBackdrop} alt="" className="artist-splash-stage-backdrop" aria-hidden="true" />
						<div className="artist-splash-overlay" />
						<div className="artist-splash-rail">
							<div className="artist-splash-rail-window portal-rail-window">
								<div
									className="artist-splash-grid"
									style={gridStyle}
								>
									{previewArtists.map((artist, index) => (
										<ArtistPreviewCard
											key={artist.id}
											artist={artist}
											index={index}
										/>
									))}
								</div>
							</div>
						</div>
						<div className="artist-splash-spotlight portal-music-spotlight-preview">
							{mobilePreviewArtists.map((artist, index) => {
								const isCenter = index === activeMobileIndex;
								const isSide = Math.abs(index - activeMobileIndex) === 1;
								const depthClass = isCenter
									? 'artist-splash-spotlight-card-center'
									: isSide
										? 'artist-splash-spotlight-card-side'
										: 'artist-splash-spotlight-card-away';

								return (
									<ArtistPreviewCard
										key={`mobile-${artist.id}-${index}`}
										artist={artist}
										index={index}
										active={isCenter}
										className={`artist-splash-spotlight-card ${depthClass}`}
									/>
								);
							})}
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
