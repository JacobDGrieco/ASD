import { useRef, useEffect } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { getVideoSourceType } from '../../lib/artistVideos.js';
import '../../styles/ArtistSplash.css';
import '../../styles/HomePortal.css';

const DEFAULT_HERO_VIDEO = 'https://yrvmwf5ltxj8zlrg.public.blob.vercel-storage.com/videos/hero-video.mov';

export const portalMusicVideoRef = { current: null };

export default function MusicHomePreview() {
	const videoRef = useRef(null);
	const { data: artists } = useApi('/api/artists');

	useEffect(() => {
		portalMusicVideoRef.current = videoRef.current;
		return () => {
			portalMusicVideoRef.current = null;
		};
	}, []);

	const heroVideo = import.meta.env.VITE_HOME_HERO_VIDEO || DEFAULT_HERO_VIDEO;
	const visibleArtists = (artists ?? []).filter((a) => a.isPubliclyVisible !== false);

	return (
		<div className="portal-preview portal-preview-music" aria-hidden="true">
			<div className="portal-live-preview">
				<div className="portal-live-preview-inner">
					<section className="artist-splash-splash">
						<video
							ref={videoRef}
							className="artist-splash-video"
							autoPlay
							muted
							loop
							playsInline
							preload="auto"
							aria-hidden="true"
						>
							<source src={heroVideo} type={getVideoSourceType(heroVideo)} />
						</video>
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
