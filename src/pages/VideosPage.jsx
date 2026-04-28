import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaExternalLinkAlt, FaPlay } from 'react-icons/fa';
import { prefetchApi, useApi } from '../hooks/useApi.js';
import { ARTIST_VIDEO_SOURCE } from '../lib/artistVideos.js';
import '../styles/VideosPage.css';

void prefetchApi('/api/videos');

function guessVideoMimeType(url) {
	if (typeof url !== 'string') return undefined;
	const normalized = url.toLowerCase();
	if (normalized.endsWith('.webm')) return 'video/webm';
	if (normalized.endsWith('.ogg') || normalized.endsWith('.ogv')) return 'video/ogg';
	return 'video/mp4';
}

function VideoPlayer({ video }) {
	if (!video) {
		return (
			<div className="videos-page-player-frame videos-page-player-empty">
				<p>Select an artist</p>
			</div>
		);
	}
	const playerTitle = video.title || `${video.artist?.name ?? 'Artist'} promo`;

	if (video.sourceType === ARTIST_VIDEO_SOURCE.YOUTUBE && video.youtubeEmbedUrl) {
		return (
			<div className="videos-page-player-frame">
				<iframe
					src={`${video.youtubeEmbedUrl}&autoplay=1&mute=1`}
					title={playerTitle}
					className="videos-page-iframe"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					referrerPolicy="strict-origin-when-cross-origin"
					allowFullScreen
				/>
			</div>
		);
	}

	if (video.sourceType === ARTIST_VIDEO_SOURCE.UPLOAD && video.videoUrl) {
		return (
			<div className="videos-page-player-frame">
				<video
					key={video.videoUrl}
					className="videos-page-video"
					autoPlay
					controls
					playsInline
					preload="metadata"
					poster={video.posterUrl || video.artist?.portrait || undefined}
				>
					<source src={video.videoUrl} type={guessVideoMimeType(video.videoUrl)} />
				</video>
			</div>
		);
	}

	return (
		<div className="videos-page-player-frame videos-page-player-empty">
			<p>This video source is not available.</p>
		</div>
	);
}

export default function VideosPage() {
	const { data: videos, loading, error } = useApi('/api/videos', { refreshAtUtcMidnight: true });
	const [selectedId, setSelectedId] = useState(null);

	const selectedVideo = useMemo(
		() => videos?.find((video) => video.id === selectedId) ?? null,
		[selectedId, videos]
	);
	const selectedTitle = selectedVideo?.title || `${selectedVideo?.artist?.name ?? 'Artist'} promo`;

	if (error && !videos) {
		return (
			<div className="page videos-page-shell">
				<section className="videos-page-status">
					<p className="videos-page-eyebrow">Videos unavailable</p>
					<h1>We could not load the artist videos.</h1>
					<p className="videos-page-detail">Request failed with: {error}</p>
				</section>
			</div>
		);
	}

	return (
		<div className="page videos-page-shell">
			<section className="videos-page-header">
				<h1 className="videos-page-title">Promo Videos</h1>
			</section>

			<section className="videos-page-card-strip" aria-label="Artist videos">
				{videos?.map((video) => {
					const isActive = video.id === selectedVideo?.id;
					const coverImage = video.posterUrl || video.artist?.portrait || '/favicon.png';
					const cardTitle = video.title || `${video.artist.name} promo`;
					return (
						<button
							key={video.id}
							type="button"
							className={isActive ? 'videos-page-card videos-page-card-active' : 'videos-page-card'}
							onClick={() => setSelectedId(video.id)}
						>
							<img src={coverImage} alt={video.artist.name} className="videos-page-card-image" loading="lazy" decoding="async" />
							<span className="videos-page-card-overlay" />
							<span className="videos-page-card-play"><FaPlay aria-hidden="true" /></span>
							<span className="videos-page-card-label">
								<strong>{video.artist.name}</strong>
								<span>{cardTitle}</span>
							</span>
						</button>
					);
				})}
				{!loading && !videos?.length && (
					<div className="videos-page-empty-state">No artist videos have been published yet.</div>
				)}
			</section>

			<section className="videos-page-stage">
				<div className="videos-page-player-column">
					<VideoPlayer video={selectedVideo} />
				</div>
				<aside className="videos-page-info">
					{selectedVideo ? (
						<>
							<h2>{selectedTitle}</h2>
							<p className="videos-page-artist-link">
								<Link to={`/artists/${selectedVideo.artist.slug}`}>{selectedVideo.artist.name}</Link>
							</p>
							{selectedVideo.description && <p>{selectedVideo.description}</p>}
							{selectedVideo.artist.bio && <p className="videos-page-bio">{selectedVideo.artist.bio}</p>}
							<div className="videos-page-actions">
								{selectedVideo.videosPageUrl && (
									<a href={selectedVideo.videosPageUrl} target="_blank" rel="noreferrer" className="videos-page-action-link">
										Full videos <FaExternalLinkAlt aria-hidden="true" />
									</a>
								)}
							</div>
						</>
					) : (
						<div className="videos-page-info-empty">
							<h2>Select an artist</h2>
						</div>
					)}
				</aside>
			</section>
		</div>
	);
}
