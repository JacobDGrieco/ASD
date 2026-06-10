import { useMemo, useState } from 'react';
import { FaExternalLinkAlt, FaPlay } from 'react-icons/fa';
import AuroraBackground from '../components/shared/AuroraBackground.jsx';
import { prefetchApi, useApi } from '../hooks/useApi.js';
import { CROSSHAIR_VIDEO_TYPE_OPTIONS } from '../lib/crosshairVideos.js';
import '../styles/CrosshairPage.css';

void prefetchApi('/api/crosshair');

const FILTERS = [
	{ value: 'ALL', label: 'All' },
	...CROSSHAIR_VIDEO_TYPE_OPTIONS,
];

function CrosshairPlayer({ video }) {
	if (!video) {
		return (
			<div className="crosshair-player-frame crosshair-player-empty">
				<div className="crosshair-player-empty-state">
					<img src="/favicon.png" alt="" className="crosshair-player-empty-logo" />
					<p>Select a video</p>
				</div>
			</div>
		);
	}

	return (
		<div className={video.type === 'SHORT' ? 'crosshair-player-frame crosshair-player-frame-short' : 'crosshair-player-frame'}>
			<iframe
				src={`${video.youtubeEmbedUrl}&autoplay=1`}
				title={video.title}
				className="crosshair-iframe"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
				referrerPolicy="strict-origin-when-cross-origin"
				allowFullScreen
			/>
		</div>
	);
}

function formatDate(value) {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CrosshairPage() {
	const { data: videos, loading, error } = useApi('/api/crosshair', { refreshAtUtcMidnight: true });
	const [activeType, setActiveType] = useState('ALL');
	const [selectedId, setSelectedId] = useState(null);

	const filteredVideos = useMemo(() => {
		const list = Array.isArray(videos) ? videos : [];
		if (activeType === 'ALL') return list;
		return list.filter((video) => video.type === activeType);
	}, [activeType, videos]);

	const selectedVideo = useMemo(
		() => filteredVideos.find((video) => video.id === selectedId) ?? filteredVideos[0] ?? null,
		[filteredVideos, selectedId]
	);

	if (error && !videos) {
		return (
			<div className="page aurora-page">
				<AuroraBackground />
				<div className="aurora-page-content crosshair-shell">
					<section className="crosshair-status">
						<p className="crosshair-eyebrow">Crosshair unavailable</p>
						<h1>We could not load the videos.</h1>
						<p className="crosshair-detail">Request failed with: {error}</p>
					</section>
				</div>
			</div>
		);
	}

	return (
		<div className="page aurora-page">
			<AuroraBackground />
			<div className="aurora-page-content crosshair-shell">
				<section className="crosshair-header">
					<div>
						<h1 className="crosshair-title">The Crosshair</h1>
						<p className="crosshair-copy">Uncut interviews, edited sessions, and shorts from ASD Records.</p>
					</div>
					<div className="crosshair-filters" aria-label="Filter Crosshair videos">
						{FILTERS.map((filter) => (
							<button
								key={filter.value}
								type="button"
								className={activeType === filter.value ? 'crosshair-filter crosshair-filter-active' : 'crosshair-filter'}
								onClick={() => {
									setActiveType(filter.value);
									setSelectedId(null);
								}}
							>
								{filter.label}
							</button>
						))}
					</div>
				</section>

				<section className="crosshair-stage">
					<div className="crosshair-player-column">
						<CrosshairPlayer video={selectedVideo} />
					</div>
					<aside className="crosshair-info">
						{selectedVideo ? (
							<>
								<p className="crosshair-source">{selectedVideo.typeLabel}</p>
								<h2>{selectedVideo.title}</h2>
								<div className="crosshair-meta">
									{formatDate(selectedVideo.publishedAt) && <span>{formatDate(selectedVideo.publishedAt)}</span>}
								</div>
								{selectedVideo.description && <p>{selectedVideo.description}</p>}
								<div className="crosshair-actions">
									<a href={selectedVideo.youtubeUrl} target="_blank" rel="noreferrer" className="crosshair-action-link">
										Watch on YouTube <FaExternalLinkAlt aria-hidden="true" />
									</a>
								</div>
							</>
						) : (
							<div className="crosshair-info-empty">
								<h2>{loading ? 'Loading videos' : 'No videos yet'}</h2>
							</div>
						)}
					</aside>
				</section>

				<section className="crosshair-grid" aria-label="Crosshair video list">
					{filteredVideos.map((video) => {
						const isActive = video.id === selectedVideo?.id;
						return (
							<button
								key={video.id}
								type="button"
								className={isActive ? 'crosshair-card crosshair-card-active' : 'crosshair-card'}
								onClick={() => setSelectedId(video.id)}
							>
								<span className={video.type === 'SHORT' ? 'crosshair-thumb crosshair-thumb-short' : 'crosshair-thumb'}>
									<img src={video.thumbnailUrl || '/favicon.png'} alt="" loading="lazy" decoding="async" />
									<span className="crosshair-card-play"><FaPlay aria-hidden="true" /></span>
								</span>
								<span className="crosshair-card-body">
									<span className="crosshair-card-type">{video.typeLabel}</span>
									<strong>{video.title}</strong>
									<span>{formatDate(video.publishedAt) || 'ASD Records'}</span>
								</span>
							</button>
						);
					})}
					{!loading && !filteredVideos.length && (
						<div className="crosshair-empty-state">No Crosshair videos have been published in this category yet.</div>
					)}
				</section>
			</div>
		</div>
	);
}
