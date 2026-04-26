import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { preloadImage, preloadImages, prefetchArtistPage } from '../../lib/publicPrefetch.js';
import '../../styles/ArtistSplash.css';

const IMAGE_TRANSITION_MS = 480;
const IMAGE_HOVER_DELAY_MS = 320;
const IMAGE_HOLD_MS = 420;
const IMAGE_LAST_HOLD_MS = 1100;
const CARD_WAVE_DELAY_MS = 120;

function uniqueUrls(urls) {
	return [...new Set(urls.filter(Boolean))];
}

function getArtistImages(artist) {
	const listedImages = Array.isArray(artist.images)
		? artist.images.map((image) => image?.previewUrl || image?.url || '').filter(Boolean)
		: [];
	const images = uniqueUrls([artist.portrait, ...listedImages]).slice(0, 4);

	return {
		images,
		defaultImage: images[0] || artist.portrait,
		sequence: images.length > 1 ? [...images.slice(1), images[0]] : [],
	};
}

function ArtistCard({ artist, imagePriority = 'auto', shouldEagerLoad = false, enterDelayMs = 0 }) {
	const { images, defaultImage, sequence } = useMemo(() => getArtistImages(artist), [artist]);
	const [currentImage, setCurrentImage] = useState(defaultImage);
	const [previousImage, setPreviousImage] = useState(null);
	const [isHovered, setIsHovered] = useState(false);
	const [isTransitioning, setIsTransitioning] = useState(false);
	const timeoutRefs = useRef([]);
	const currentImageRef = useRef(defaultImage);
	const hoverRunIdRef = useRef(0);

	const clearTimers = () => {
		timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
		timeoutRefs.current = [];
	};

	const wait = (ms) => new Promise((resolve) => {
		const timeoutId = window.setTimeout(resolve, ms);
		timeoutRefs.current.push(timeoutId);
	});

	useEffect(() => {
		currentImageRef.current = currentImage;
	}, [currentImage]);

	useEffect(() => {
		clearTimers();
		hoverRunIdRef.current += 1;
		setCurrentImage(defaultImage);
		currentImageRef.current = defaultImage;
		setPreviousImage(null);
		setIsTransitioning(false);
	}, [defaultImage]);

	useEffect(() => {
		if (!defaultImage) return undefined;
		void preloadImage(defaultImage, { priority: imagePriority });
		void preloadImages(images.slice(1), { priority: imagePriority });
		return undefined;
	}, [defaultImage, imagePriority, images]);

	useEffect(() => {
		clearTimers();
		hoverRunIdRef.current += 1;

		if (!isHovered || sequence.length === 0) {
			setCurrentImage(defaultImage);
			setPreviousImage(null);
			setIsTransitioning(false);
			return clearTimers;
		}

		const runId = hoverRunIdRef.current;

		const runSequence = async () => {
			void preloadImages(sequence, { priority: 'high' });
			await wait(IMAGE_HOVER_DELAY_MS);
			if (hoverRunIdRef.current !== runId) return;

			while (hoverRunIdRef.current === runId) {
				for (const [index, image] of sequence.entries()) {
					if (hoverRunIdRef.current !== runId) return;

					const activeImage = currentImageRef.current;
					if (activeImage !== image) {
						setPreviousImage(activeImage);
						setCurrentImage(image);
						currentImageRef.current = image;
						setIsTransitioning(true);
						await wait(IMAGE_TRANSITION_MS);
						if (hoverRunIdRef.current !== runId) return;
						setPreviousImage(null);
						setIsTransitioning(false);
					}

					const holdDuration = index === sequence.length - 1 ? IMAGE_LAST_HOLD_MS : IMAGE_HOLD_MS;
					await wait(holdDuration);
					if (hoverRunIdRef.current !== runId) return;
				}
			}
		};

		void runSequence();

		return clearTimers;
	}, [defaultImage, isHovered, sequence]);

	function handlePointerEnter() {
		prefetchArtistPage(artist);
		setIsHovered(true);
	}

	return (
		<Link
			to={`/artists/${artist.slug}`}
			className="artist-splash-card"
			style={{ '--artist-splash-enter-delay': `${enterDelayMs}ms` }}
			onMouseEnter={handlePointerEnter}
			onMouseLeave={() => setIsHovered(false)}
			onFocus={handlePointerEnter}
			onTouchStart={handlePointerEnter}
			onBlur={() => setIsHovered(false)}
		>
			<span className="artist-splash-name-art" data-text={artist.name}>
				{artist.name}
			</span>
			<div className="artist-splash-card-frame">
				{previousImage && (
					<img
						key={`previous-${previousImage}`}
						src={previousImage}
						alt=""
						aria-hidden="true"
						className={`artist-splash-portrait artist-splash-portrait-prev ${isTransitioning ? 'artist-splash-exit-left' : ''}`.trim()}
						decoding="async"
					/>
				)}
				{currentImage && (
					<img
						key={`current-${currentImage}`}
						src={currentImage}
						alt={artist.name}
						className={`artist-splash-portrait artist-splash-portrait-current ${isTransitioning ? 'artist-splash-enter-right' : ''}`.trim()}
						loading="eager"
						fetchPriority={imagePriority}
						decoding="async"
					/>
				)}
			</div>
		</Link>
	);
}

export default function ArtistSplash({ artists }) {
	const heroVideo = import.meta.env.VITE_HOME_HERO_VIDEO || '/hero-video.mp4';
	const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
	const priorityCount = 3;

	useEffect(() => {
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const connection = navigator.connection;
		const shouldSkipVideo = prefersReducedMotion || connection?.saveData;

		if (shouldSkipVideo) return;

		const callback = () => setShouldLoadVideo(true);
		const handle = window.requestIdleCallback
			? window.requestIdleCallback(callback, { timeout: 1200 })
			: window.setTimeout(callback, 250);

		return () => {
			if (window.requestIdleCallback && window.cancelIdleCallback) {
				window.cancelIdleCallback(handle);
				return;
			}
			window.clearTimeout(handle);
		};
	}, []);

	return (
		<section className="artist-splash-splash">
			{shouldLoadVideo && (
				<video
					className="artist-splash-video"
					autoPlay
					muted
					loop
					playsInline
					preload="metadata"
					aria-hidden="true"
				>
					<source src={heroVideo} type="video/mp4" />
				</video>
			)}
			<div className="artist-splash-overlay" />
			<div className="artist-splash-grid">
				{artists.map((artist, index) => (
					<ArtistCard
						key={artist.id}
						artist={artist}
						imagePriority={index < priorityCount ? 'high' : 'auto'}
						shouldEagerLoad={index < priorityCount}
						enterDelayMs={index * CARD_WAVE_DELAY_MS}
					/>
				))}
			</div>
		</section>
	);
}
