import { useEffect, useMemo, useRef, useState } from 'react';
import { FaApple, FaSoundcloud, FaSpotify, FaYoutube } from 'react-icons/fa';
import { SiFacebook, SiInstagram, SiSnapchat, SiTiktok, SiX, SiYoutube } from 'react-icons/si';
import { preloadImage, preloadImages } from '../../lib/publicPrefetch.js';
import '../../styles/ArtistHero.css';

const IMAGE_TRANSITION_MS = 480;
const IMAGE_HOVER_DELAY_MS = 320;
const IMAGE_HOLD_MS = 420;
const IMAGE_LAST_HOLD_MS = 1100;

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

export default function ArtistHero({ artist }) {
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
		void preloadImage(defaultImage, { priority: 'high' });
		void preloadImages(images.slice(1), { priority: 'high' });
		return undefined;
	}, [defaultImage, images]);

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

	const musicLinks = [
		artist.soundcloudProfile ? { href: artist.soundcloudProfile, label: 'SoundCloud', icon: <FaSoundcloud /> } : null,
		artist.spotifyProfile ? { href: artist.spotifyProfile, label: 'Spotify', icon: <FaSpotify /> } : null,
		artist.appleMusicProfile ? { href: artist.appleMusicProfile, label: 'Apple Music', icon: <FaApple /> } : null,
		artist.youtubeProfile ? { href: artist.youtubeProfile, label: 'YouTube Music', icon: <FaYoutube /> } : null,
	].filter(Boolean);

	const socialLinks = [
		artist.instagramProfile ? { href: artist.instagramProfile, label: 'Instagram', icon: <SiInstagram /> } : null,
		artist.twitterProfile ? { href: artist.twitterProfile, label: 'X', icon: <SiX /> } : null,
		artist.facebookProfile ? { href: artist.facebookProfile, label: 'Facebook', icon: <SiFacebook /> } : null,
		artist.tiktokProfile ? { href: artist.tiktokProfile, label: 'TikTok', icon: <SiTiktok /> } : null,
		artist.snapchatProfile ? { href: artist.snapchatProfile, label: 'Snapchat', icon: <SiSnapchat /> } : null,
		artist.youtubeSocialProfile ? { href: artist.youtubeSocialProfile, label: 'YouTube', icon: <SiYoutube /> } : null,
	].filter(Boolean);

	return (
		<section className="artist-hero-hero">
			<div
				className="artist-hero-portrait-wrap"
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				onFocus={() => setIsHovered(true)}
				onBlur={() => setIsHovered(false)}
			>
				<div className="artist-hero-portrait-frame" tabIndex={0}>
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
				{(musicLinks.length > 0 || socialLinks.length > 0) && (
					<div className="artist-hero-link-groups">
						{musicLinks.length > 0 && (
							<div className="artist-hero-link-group">
								<span className="artist-hero-link-group-label">Music</span>
								<div className="artist-hero-links">
									{musicLinks.map((link) => (
										<a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label} title={link.label}>
											{link.icon}
										</a>
									))}
								</div>
							</div>
						)}
						{socialLinks.length > 0 && (
							<div className="artist-hero-link-group">
								<span className="artist-hero-link-group-label">Social</span>
								<div className="artist-hero-links">
									{socialLinks.map((link) => (
										<a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label} title={link.label}>
											{link.icon}
										</a>
									))}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
			<div className="artist-hero-info">
				<h1 className="artist-hero-name">{artist.name}</h1>
				<p className="artist-hero-bio">{artist.bio}</p>
				{artist.aboutMe && <p className="artist-hero-about">{artist.aboutMe}</p>}
			</div>
		</section>
	);
}
