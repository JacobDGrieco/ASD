import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { preloadImage, preloadImages, prefetchArtistPage } from '../../lib/publicPrefetch.js';
import musicStageBackdrop from '../../assets/music-tour-stage-backdrop.png';
import '../../styles/ArtistSplash.css';

const AUTO_SWAP_INTERVAL_MS = 1400;
const IMAGE_TRANSITION_MS = 480;
const CARD_WAVE_DELAY_MS = 260;
const MOBILE_SPOTLIGHT_QUERY = '(max-width: 640px)';

function uniqueUrls(urls) {
	return [...new Set(urls.flatMap((url) => (url ? [url] : [])))];
}

function scrollPastSection(event, sectionSelector) {
	const section = event.currentTarget.closest(sectionSelector);
	const target = section?.nextElementSibling;
	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (target) {
		target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
		return;
	}

	window.scrollBy({
		top: Math.max(window.innerHeight - 80, 320),
		behavior: prefersReducedMotion ? 'auto' : 'smooth',
	});
}

function getArtistImages(artist) {
	const listedImages = Array.isArray(artist.images)
		? artist.images.flatMap((image) => {
			const url = image?.previewUrl || image?.url || '';
			return url ? [url] : [];
		})
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

function cardVisualStateReducer(state, action) {
	switch (action.type) {
		case 'reset':
			return {
				currentImage: action.image,
				previousImage: null,
				isTransitioning: false,
				isActive: action.isActive,
			};
		case 'setActive':
			return { ...state, isActive: action.isActive };
		case 'transitionStart':
			return {
				currentImage: action.image,
				previousImage: action.previousImage,
				isTransitioning: true,
				isActive: true,
			};
		case 'transitionEnd':
			return { ...state, previousImage: null, isTransitioning: false };
		default:
			return state;
	}
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
	const [{ currentImage, previousImage, isTransitioning, isActive }, dispatchVisualState] = useReducer(
		cardVisualStateReducer,
		{ defaultImage, forcedActive },
		({ defaultImage: image, forcedActive: active }) => ({
			currentImage: image,
			previousImage: null,
			isTransitioning: false,
			isActive: active,
		})
	);
	const timeoutRefs = useRef([]);
	const currentImageRef = useRef(defaultImage);
	const cycleRunIdRef = useRef(0);
	const nameScale = getNameArtScale(artist.name);

	const clearTimers = useCallback(() => {
		timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
		timeoutRefs.current = [];
	}, []);

	const wait = useCallback((ms) => new Promise((resolve) => {
		const timeoutId = window.setTimeout(resolve, ms);
		timeoutRefs.current.push(timeoutId);
	}), []);

	useEffect(() => {
		currentImageRef.current = currentImage;
	}, [currentImage]);

	useEffect(() => {
		clearTimers();
		cycleRunIdRef.current += 1;
		currentImageRef.current = defaultImage;
		dispatchVisualState({ type: 'reset', image: defaultImage, isActive: forcedActive });
	}, [defaultImage, forcedActive]);

	useEffect(() => {
		if (!defaultImage) return undefined;
		void preloadImage(defaultImage, { priority: imagePriority });
		void preloadImages(images.slice(1), { priority: imagePriority });
		return undefined;
	}, [defaultImage, imagePriority, images]);

	const resetToDefault = useCallback(() => {
		clearTimers();
		cycleRunIdRef.current += 1;
		currentImageRef.current = defaultImage;
		dispatchVisualState({ type: 'reset', image: defaultImage, isActive: forcedActive });
	}, [clearTimers, defaultImage, forcedActive]);

	const startSequence = useCallback(() => {
		dispatchVisualState({ type: 'setActive', isActive: true });

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
					currentImageRef.current = image;
					dispatchVisualState({ type: 'transitionStart', image, previousImage: activeImage });
					await wait(IMAGE_TRANSITION_MS);
					if (cycleRunIdRef.current !== runId) return;
					dispatchVisualState({ type: 'transitionEnd' });
				}

				nextIndex = (nextIndex + 1) % sequence.length;
				await wait(AUTO_SWAP_INTERVAL_MS);
			}
		};

		void runSequence();
	}, [clearTimers, sequence, wait]);

	useEffect(() => {
		resetToDefault();
		return clearTimers;
	}, [clearTimers, resetToDefault, sequence]);

	useEffect(() => {
		if (autoPreview && forcedActive) {
			startSequence();
			return clearTimers;
		}

		if (forcedActive) {
			dispatchVisualState({ type: 'setActive', isActive: true });
			return undefined;
		}

		resetToDefault();
		return undefined;
	}, [autoPreview, clearTimers, forcedActive, resetToDefault, startSequence]);

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
				<div className="artist-splash-card-image-window">
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
			</div>
		</Element>
	);
}

function ArtistSplashRail({ artists }) {
	const scrollRef = useRef(null);
	const { canScroll, atStart, atEnd } = useOverflowControls(scrollRef, true);
	const priorityCount = 3;
	const rowCount = artists.length >= 5 ? 2 : 1;
	const columnCount = Math.max(1, Math.ceil(artists.length / rowCount));
	const cardMaxWidth = rowCount === 2 ? 280 : 320;
	const cardHeightLimit = rowCount === 2 ? '27dvh' : '48dvh';
	const totalGap = Math.max(0, columnCount - 1) * 20;
	const wideColumnCount = Math.max(1, artists.length);
	const wideTotalGap = Math.max(0, wideColumnCount - 1) * 24;
	const gridStyle = {
		'--artist-splash-grid-columns': columnCount,
		'--artist-splash-grid-max': `${columnCount * cardMaxWidth + totalGap}px`,
		'--artist-splash-card-basis': `min(${cardMaxWidth}px, ${cardHeightLimit}, calc((100% - ${totalGap}px) / ${columnCount}))`,
		'--artist-splash-wide-grid-max': `${wideColumnCount * 340 + wideTotalGap}px`,
		'--artist-splash-wide-card-basis': `min(340px, 43dvh, calc((100% - ${wideTotalGap}px) / ${wideColumnCount}))`,
	};

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
				<div
					className={`artist-splash-grid ${canScroll ? 'artist-splash-grid-scrollable' : ''}`.trim()}
					style={gridStyle}
				>
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

	const goToIndex = (index) => {
		if (artistCount === 0) return;
		setActiveIndex((index + artistCount) % artistCount);
	};

	const safeActiveIndex = artistCount > 0 ? activeIndex % artistCount : 0;
	const activeArtist = artists[safeActiveIndex];

	const getSpotlightPosition = (index) => {
		if (index === safeActiveIndex) return 'center';
		if (artistCount <= 1) return 'hidden';

		let offset = index - safeActiveIndex;
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
	const isMobileSpotlight = useMediaQuery(MOBILE_SPOTLIGHT_QUERY);

	return (
		<section className="artist-splash-splash">
			<img src={musicStageBackdrop} alt="" className="artist-splash-stage-backdrop" aria-hidden="true" />
			<div className="artist-splash-overlay" />
			{isMobileSpotlight ? <ArtistSpotlightCarousel artists={artists} /> : <ArtistSplashRail artists={artists} />}
			<button
				type="button"
				className="artist-splash-scroll-cue"
				aria-label="Scroll to more music content"
				onClick={(event) => scrollPastSection(event, '.artist-splash-splash')}
			>
				<span aria-hidden="true" />
			</button>
		</section>
	);
}
