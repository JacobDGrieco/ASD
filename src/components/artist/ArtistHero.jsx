import { useEffect, useMemo, useReducer, useRef } from 'react';
import { PROFILE_LINK_PLATFORM_LABELS, hrefForProfileLink, normalizeProfileLinks } from '../../lib/profileLinks.js';
import { preloadImage, preloadImages } from '../../lib/publicPrefetch.js';
import ArtworkGallery from '../shared/ArtworkGallery.jsx';
import ProfileLinkIcon from '../shared/ProfileLinkIcon.jsx';
import '../../styles/ArtistHero.css';

const AUTO_SWAP_INTERVAL_MS = 20000;
const IMAGE_TRANSITION_MS = 480;

function uniqueUrls(urls) {
	return [...new Set(urls.flatMap((url) => (url ? [url] : [])))];
}

function renderProfileLink(link) {
	const label = PROFILE_LINK_PLATFORM_LABELS[link.platform] ?? 'Link';
	return (
		<a
			key={link.id}
			href={hrefForProfileLink(link)}
			target={link.platform === 'email' ? undefined : '_blank'}
			rel={link.platform === 'email' ? undefined : 'noopener noreferrer'}
			aria-label={label}
			title={label}
		>
			<ProfileLinkIcon platform={link.platform} />
		</a>
	);
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

function imageStateReducer(state, action) {
	switch (action.type) {
		case 'reset':
			return { currentImage: action.image, previousImage: null, isTransitioning: false };
		case 'transitionStart':
			return { currentImage: action.image, previousImage: action.previousImage, isTransitioning: true };
		case 'transitionEnd':
			return { ...state, previousImage: null, isTransitioning: false };
		default:
			return state;
	}
}

export default function ArtistHero({ artist, actions = null }) {
	const { images, defaultImage, sequence } = useMemo(() => getArtistImages(artist), [artist]);
	const [{ currentImage, previousImage, isTransitioning }, dispatchImageState] = useReducer(
		imageStateReducer,
		defaultImage,
		(image) => ({ currentImage: image, previousImage: null, isTransitioning: false })
	);
	const timeoutRefs = useRef([]);
	const currentImageRef = useRef(defaultImage);
	const cycleRunIdRef = useRef(0);

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
		currentImageRef.current = defaultImage;
		dispatchImageState({ type: 'reset', image: defaultImage });
	}, [defaultImage]);

	useEffect(() => {
		if (!defaultImage) return undefined;
		void preloadImage(defaultImage, { priority: 'high' });
		void preloadImages(images.slice(1), { priority: 'high' });
		return undefined;
	}, [defaultImage, images]);

	useEffect(() => {
		clearTimers();
		cycleRunIdRef.current += 1;

		if (sequence.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			dispatchImageState({ type: 'reset', image: defaultImage });
			return clearTimers;
		}

		const runId = cycleRunIdRef.current;

		const runSequence = async () => {
			void preloadImages(sequence, { priority: 'high' });

			let nextIndex = 0;

			while (cycleRunIdRef.current === runId) {
				const image = sequence[nextIndex];
				if (cycleRunIdRef.current !== runId) return;

				await wait(AUTO_SWAP_INTERVAL_MS);
				if (cycleRunIdRef.current !== runId) return;

				const activeImage = currentImageRef.current;
				if (activeImage !== image) {
					currentImageRef.current = image;
					dispatchImageState({ type: 'transitionStart', image, previousImage: activeImage });
					await wait(IMAGE_TRANSITION_MS);
					if (cycleRunIdRef.current !== runId) return;
					dispatchImageState({ type: 'transitionEnd' });
				}

				nextIndex = (nextIndex + 1) % sequence.length;
			}
		};

		void runSequence();

		return clearTimers;
	}, [defaultImage, sequence]);

	const profileLinks = normalizeProfileLinks(artist.links);
	const professionalLinks = profileLinks.filter((link) => link.type === 'professional');
	const personalLinks = profileLinks.filter((link) => link.type === 'personal');

	return (
		<section className={`artist-hero-hero ${artist.isPubliclyVisible === false ? 'artist-hero-hero-hidden' : ''}`.trim()}>
			<div className="artist-hero-portrait-wrap">
				<div className="artist-hero-portrait-frame">
					<ArtworkGallery images={artist.images} title={artist.name} buttonLabel={`View ${artist.name} images`} />
					{previousImage && (
						<img
							key={`previous-${previousImage}`}
							src={previousImage}
							alt=""
							aria-hidden="true"
							className={`artist-hero-portrait artist-hero-portrait-prev ${isTransitioning ? 'artist-hero-exit-left' : ''}`.trim()}
							decoding="async"
						/>
					)}
					{currentImage && (
						<img
							key={`current-${currentImage}`}
							src={currentImage}
							alt={artist.name}
							className={`artist-hero-portrait artist-hero-portrait-current ${isTransitioning ? 'artist-hero-enter-right' : ''}`.trim()}
							loading="eager"
							fetchPriority="high"
							decoding="async"
						/>
					)}
				</div>
				{(professionalLinks.length > 0 || personalLinks.length > 0) && (
					<div className="artist-hero-link-groups">
						{professionalLinks.length > 0 && (
							<div className="artist-hero-link-group">
								<span className="artist-hero-link-group-label">Music</span>
								<div className="artist-hero-links">
									{professionalLinks.map(renderProfileLink)}
								</div>
							</div>
						)}
						{personalLinks.length > 0 && (
							<div className="artist-hero-link-group">
								<span className="artist-hero-link-group-label">Personal</span>
								<div className="artist-hero-links">
									{personalLinks.map(renderProfileLink)}
								</div>
							</div>
						)}
					</div>
				)}
				{actions && (
					<div className="artist-hero-actions player-page-actions">
						{actions}
					</div>
				)}
			</div>
			<div className="artist-hero-info">
				{artist.isPubliclyVisible === false && <span className="artist-hero-visibility-badge">Hidden in public view</span>}
				<h1 className="artist-hero-name">{artist.name}</h1>
				<p className="artist-hero-bio">{artist.bio}</p>
				{artist.aboutMe && <p className="artist-hero-about">{artist.aboutMe}</p>}
			</div>
		</section>
	);
}
