import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { preloadImage, preloadImages, prefetchArtistPage } from '../../lib/publicPrefetch.js';
import { getVideoSourceType } from '../../lib/artistVideos.js';
import { consumePortalVideoTime, consumePortalVideoElement } from '../../lib/portalVideoTime.js';
import '../../styles/ArtistSplash.css';

const AUTO_SWAP_INTERVAL_MS = 1400;
const IMAGE_TRANSITION_MS = 480;
const CARD_WAVE_DELAY_MS = 260;
const DEFAULT_HERO_VIDEO = 'https://yrvmwf5ltxj8zlrg.public.blob.vercel-storage.com/videos/hero-video.mov';
const MOBILE_SPOTLIGHT_QUERY = '(max-width: 640px)';

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

function getNameArtScale(name) {
	const safeName = typeof name === 'string' ? name : '';
	const weightedLength = safeName.replace(/\s+/g, '').length + (safeName.match(/\s/g)?.length ?? 0) * 0.45;

	return Math.max(0.72, Math.min(1, 7.6 / Math.max(1, weightedLength)));
}

function useMediaQuery(query) {
	const [matches, setMatches] = useState(() => (
		typeof window !== 'undefined' ? window.matchMedia(query).matches : false
	));

	useEffect(() => {
		const mediaQuery = window.matchMedia(query);
		const updateMatches = () => setMatches(mediaQuery.matches);

		updateMatches();
		mediaQuery.addEventListener('change', updateMatches);

		return () => mediaQuery.removeEventListener('change', updateMatches);
	}, [query]);

	return matches;
}

function useOverflowControls(scrollRef, enabled) {
	const [state, setState] = useState({
		canScroll: false,
		atStart: true,
		atEnd: true,
	});

	useEffect(() => {
		const element = scrollRef.current;
		if (!enabled || !element) {
			setState({ canScroll: false, atStart: true, atEnd: true });
			return undefined;
		}

		let frameId = null;
		const updateState = () => {
			if (frameId) window.cancelAnimationFrame(frameId);

			frameId = window.requestAnimationFrame(() => {
				const maxScrollLeft = element.scrollWidth - element.clientWidth;
				const overflowThreshold = element.clientWidth * 0.05;
				const canScroll = maxScrollLeft > overflowThreshold;

				setState({
					canScroll,
					atStart: !canScroll || element.scrollLeft <= 1,
					atEnd: !canScroll || element.scrollLeft >= maxScrollLeft - 1,
				});
			});
		};

		updateState();
		element.addEventListener('scroll', updateState, { passive: true });

		const resizeObserver = new ResizeObserver(updateState);
		resizeObserver.observe(element);
		Array.from(element.children).forEach((child) => resizeObserver.observe(child));
		window.addEventListener('resize', updateState);

		return () => {
			if (frameId) window.cancelAnimationFrame(frameId);
			element.removeEventListener('scroll', updateState);
			resizeObserver.disconnect();
			window.removeEventListener('resize', updateState);
		};
	}, [enabled, scrollRef]);

	return state;
}

function ArtistCard({
	artist,
	imagePriority = 'auto',
	enterDelayMs = 0,
	className = '',
	forcedActive = false,
	autoPreview = false,
	previewOnHover = true,
	as = 'link',
	onClick = null,
}) {
	const { images, defaultImage, sequence } = useMemo(() => getArtistImages(artist), [artist]);
	const [currentImage, setCurrentImage] = useState(defaultImage);
	const [previousImage, setPreviousImage] = useState(null);
	const [isTransitioning, setIsTransitioning] = useState(false);
	const [isActive, setIsActive] = useState(false);
	const timeoutRefs = useRef([]);
	const currentImageRef = useRef(defaultImage);
	const cycleRunIdRef = useRef(0);
	const nameScale = getNameArtScale(artist.name);

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
		cycleRunIdRef.current += 1;
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

	const resetToDefault = () => {
		clearTimers();
		cycleRunIdRef.current += 1;
		setIsActive(forcedActive);
		setCurrentImage(defaultImage);
		currentImageRef.current = defaultImage;
		setPreviousImage(null);
		setIsTransitioning(false);
	};

	const startSequence = () => {
		setIsActive(true);

		if (sequence.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return;
		}

		clearTimers();
		cycleRunIdRef.current += 1;
		const runId = cycleRunIdRef.current;

		const runSequence = async () => {
			void preloadImages(sequence, { priority: 'high' });

			let nextIndex = 0;

			while (cycleRunIdRef.current === runId) {
				const image = sequence[nextIndex];
				if (cycleRunIdRef.current !== runId) return;

				const activeImage = currentImageRef.current;
				if (activeImage !== image) {
					setPreviousImage(activeImage);
					setCurrentImage(image);
					currentImageRef.current = image;
					setIsTransitioning(true);
					await wait(IMAGE_TRANSITION_MS);
					if (cycleRunIdRef.current !== runId) return;
					setPreviousImage(null);
					setIsTransitioning(false);
				}

				nextIndex = (nextIndex + 1) % sequence.length;
				await wait(AUTO_SWAP_INTERVAL_MS);
			}
		};

		void runSequence();
	};

	useEffect(() => {
		resetToDefault();
		return clearTimers;
	}, [defaultImage, sequence]);

	useEffect(() => {
		if (autoPreview && forcedActive) {
			startSequence();
			return clearTimers;
		}

		if (forcedActive) {
			setIsActive(true);
			return undefined;
		}

		resetToDefault();
		return undefined;
	}, [autoPreview, defaultImage, forcedActive, sequence]);

	const visualActive = isActive || forcedActive;
	const Element = as === 'button' ? 'button' : Link;
	const elementProps = as === 'button'
		? { type: 'button', onClick }
		: { to: `/artists/${artist.slug}`, onClick };

	return (
		<Element
			{...elementProps}
			aria-label={`View ${artist.name}`}
			className={`artist-splash-card ${visualActive ? 'artist-splash-card-active' : ''} ${artist.isPubliclyVisible === false ? 'artist-splash-card-hidden' : ''} ${className}`.trim()}
			style={{
				'--artist-splash-enter-delay': `${enterDelayMs}ms`,
				'--artist-splash-name-min': `${1.75 * nameScale}rem`,
				'--artist-splash-name-fluid': `${3.8 * nameScale}vw`,
				'--artist-splash-name-max': `${3.65 * nameScale}rem`,
				'--artist-splash-name-mobile-min': `${1.25 * nameScale}rem`,
				'--artist-splash-name-mobile-fluid': `${7.8 * nameScale}vw`,
				'--artist-splash-name-mobile-max': `${2.45 * nameScale}rem`,
				'--artist-splash-name-center-min': `${1.45 * nameScale}rem`,
				'--artist-splash-name-center-fluid': `${8.4 * nameScale}vw`,
				'--artist-splash-name-center-max': `${2.9 * nameScale}rem`,
			}}
			onMouseEnter={() => {
				prefetchArtistPage(artist);
				if (previewOnHover) startSequence();
			}}
			onMouseLeave={() => {
				if (previewOnHover && !forcedActive) resetToDefault();
			}}
			onFocus={() => {
				prefetchArtistPage(artist);
				if (previewOnHover) startSequence();
			}}
			onBlur={() => {
				if (previewOnHover && !forcedActive) resetToDefault();
			}}
			onTouchStart={() => prefetchArtistPage(artist)}
		>
			<span className="artist-splash-name-art" data-text={artist.name}>
				<span className="artist-splash-name-outline">{artist.name}</span>
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
						alt=""
						aria-hidden="true"
						className={`artist-splash-portrait artist-splash-portrait-current ${isTransitioning ? 'artist-splash-enter-right' : ''}`.trim()}
						loading="eager"
						fetchPriority={imagePriority}
						decoding="async"
					/>
				)}
			</div>
		</Element>
	);
}

function ArtistSplashRail({ artists }) {
	const scrollRef = useRef(null);
	const { canScroll, atStart, atEnd } = useOverflowControls(scrollRef, true);
	const priorityCount = 3;

	const scrollByPage = (direction) => {
		const element = scrollRef.current;
		if (!element) return;

		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		element.scrollBy({
			left: direction * Math.max(element.clientWidth * 0.82, 260),
			behavior: prefersReducedMotion ? 'auto' : 'smooth',
		});
	};

	return (
		<div className={`artist-splash-rail ${canScroll ? 'artist-splash-rail-scrollable' : ''}`}>
			{canScroll && (
				<button
					type="button"
					className="artist-splash-rail-arrow artist-splash-rail-arrow-prev"
					onClick={() => scrollByPage(-1)}
					disabled={atStart}
					aria-label="Previous artists"
				>
					<span aria-hidden="true" />
				</button>
			)}
			<div className="artist-splash-rail-window" ref={scrollRef}>
				<div className={`artist-splash-grid ${canScroll ? 'artist-splash-grid-scrollable' : ''}`}>
					{artists.map((artist, index) => (
						<ArtistCard
							key={artist.id}
							artist={artist}
							imagePriority={index < priorityCount ? 'high' : 'auto'}
							enterDelayMs={index * CARD_WAVE_DELAY_MS}
						/>
					))}
				</div>
			</div>
			{canScroll && (
				<button
					type="button"
					className="artist-splash-rail-arrow artist-splash-rail-arrow-next"
					onClick={() => scrollByPage(1)}
					disabled={atEnd}
					aria-label="Next artists"
				>
					<span aria-hidden="true" />
				</button>
			)}
		</div>
	);
}

function ArtistSpotlightCarousel({ artists }) {
	const [activeIndex, setActiveIndex] = useState(0);
	const touchStartXRef = useRef(null);
	const didSwipeRef = useRef(false);
	const navigate = useNavigate();
	const artistCount = artists.length;

	useEffect(() => {
		if (activeIndex < artistCount) return;
		setActiveIndex(0);
	}, [activeIndex, artistCount]);

	const goToIndex = (index) => {
		if (artistCount === 0) return;
		setActiveIndex((index + artistCount) % artistCount);
	};

	const activeArtist = artists[activeIndex];

	const getSpotlightPosition = (index) => {
		if (index === activeIndex) return 'center';
		if (artistCount <= 1) return 'hidden';

		let offset = index - activeIndex;
		if (offset > artistCount / 2) offset -= artistCount;
		if (offset < artistCount / -2) offset += artistCount;

		if (offset === -1) return 'prev';
		if (offset === 1) return 'next';
		return 'hidden';
	};

	const handlePointerDown = (event) => {
		touchStartXRef.current = event.clientX;
	};

	const handlePointerUp = (event) => {
		if (touchStartXRef.current === null) return;

		const deltaX = event.clientX - touchStartXRef.current;
		touchStartXRef.current = null;

		if (Math.abs(deltaX) < 36) return;
		didSwipeRef.current = true;
		goToIndex(deltaX > 0 ? activeIndex - 1 : activeIndex + 1);
		window.setTimeout(() => {
			didSwipeRef.current = false;
		}, 120);
	};

	if (!activeArtist) return null;

	return (
		<div
			className="artist-splash-spotlight"
			onPointerDown={handlePointerDown}
			onPointerUp={handlePointerUp}
			onPointerCancel={() => {
				touchStartXRef.current = null;
			}}
		>
			{artists.map((artist, index) => {
				const position = getSpotlightPosition(index);
				const isCenter = position === 'center';
				const isSide = position === 'prev' || position === 'next';

				return (
					<ArtistCard
						key={artist.id}
						artist={artist}
						as="button"
						className={`artist-splash-spotlight-card artist-splash-spotlight-card-${position} ${isSide ? 'artist-splash-spotlight-card-side' : ''}`.trim()}
						imagePriority={isCenter ? 'high' : 'auto'}
						forcedActive={isCenter}
						autoPreview={isCenter}
						previewOnHover={false}
						onClick={() => {
							if (didSwipeRef.current) return;
							if (isCenter) {
								navigate(`/artists/${artist.slug}`);
								return;
							}
							goToIndex(index);
						}}
					/>
				);
			})}
		</div>
	);
}

export default function ArtistSplash({ artists }) {
	const heroVideos = useMemo(() => uniqueUrls([
		import.meta.env.VITE_HOME_HERO_VIDEO,
		DEFAULT_HERO_VIDEO,
	]), []);
	const portalVideoElement = useRef(consumePortalVideoElement());
	const portalTime = useRef(consumePortalVideoTime());
	const cameFromPortal = useRef(portalVideoElement.current !== null || portalTime.current !== null);
	const [shouldLoadVideo, setShouldLoadVideo] = useState(
		portalVideoElement.current !== null || portalTime.current !== null,
	);
	const isMobileSpotlight = useMediaQuery(MOBILE_SPOTLIGHT_QUERY);
	const videoRef = useRef(null);
	const videoContainerRef = useRef(null);

	// Move the portal's live video element into this section synchronously so it's
	// in the DOM when the view-transition snapshot is taken (useLayoutEffect fires
	// inside flushSync before startViewTransition captures the new state).
	useLayoutEffect(() => {
		const video = portalVideoElement.current;
		const container = videoContainerRef.current;
		if (!video || !container) return;
		container.appendChild(video);
		videoRef.current = video;
		return () => {
			portalVideoElement.current = null;
		};
	}, []);

	useEffect(() => {
		if (portalVideoElement.current !== null || portalTime.current !== null) {
			return undefined;
		}

		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const connection = navigator.connection;
		const shouldSkipVideo = prefersReducedMotion || connection?.saveData;

		if (shouldSkipVideo) return undefined;

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

	// Seek fallback: only needed when we created a new video element (no element transfer).
	useEffect(() => {
		if (portalVideoElement.current !== null) return;
		if (portalTime.current === null || !videoRef.current) return;
		videoRef.current.currentTime = portalTime.current;
		portalTime.current = null;
	}, [shouldLoadVideo]);

	return (
		<section className={`artist-splash-splash${cameFromPortal.current ? ' artist-splash-from-portal' : ''}`}>
			{shouldLoadVideo && portalVideoElement.current && (
				<div ref={videoContainerRef} aria-hidden="true" />
			)}
			{shouldLoadVideo && !portalVideoElement.current && (
				<video
					ref={videoRef}
					className="artist-splash-video"
					autoPlay
					muted
					loop
					playsInline
					preload="metadata"
					aria-hidden="true"
				>
					{heroVideos.map((heroVideo) => (
						<source
							key={heroVideo}
							src={heroVideo}
							type={getVideoSourceType(heroVideo)}
						/>
					))}
				</video>
			)}
			<div className="artist-splash-overlay" />
			{isMobileSpotlight ? <ArtistSpotlightCarousel artists={artists} /> : <ArtistSplashRail artists={artists} />}
		</section>
	);
}
