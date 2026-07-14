import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import MusicHomePreview from '../components/home/MusicHomePreview.jsx';
import FashionHomePreview from '../components/home/FashionHomePreview.jsx';
import { useApi } from '../hooks/useApi.js';
import { useCompanyProfile } from '../hooks/useCompanyProfile.js';
import { getCompanyMemberImage } from '../lib/companyProfile.js';
import '../styles/HomePortal.css';

const EXPAND_MS = 820;

const SECTIONS = [
	{
		key: 'music',
		label: 'Music',
		path: '/music',
		description: 'Artists, The Shelf, The Crosshair, and the living record-player catalog.',
		Preview: MusicHomePreview,
	},
	{
		key: 'fashion',
		label: 'Fashion',
		path: '/fashion',
		description: 'Talent profiles, editorial looks, and shoppable catalogue pieces.',
		Preview: FashionHomePreview,
	},
];

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

function getScrollbarWidth() {
	const measuredWidth = window.innerWidth - document.documentElement.clientWidth;
	if (measuredWidth > 0) return measuredWidth;

	const probe = document.createElement('div');
	probe.style.position = 'absolute';
	probe.style.top = '-9999px';
	probe.style.width = '100px';
	probe.style.height = '100px';
	probe.style.overflow = 'scroll';
	document.body.appendChild(probe);
	const scrollbarWidth = probe.offsetWidth - probe.clientWidth;
	probe.remove();

	return Math.max(scrollbarWidth, 0);
}

function getInitials(name = '') {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join('');
}

export default function HomePage() {
	const navigate = useNavigate();
	const [hoveredKey, setHoveredKey] = useState(null);
	const [expandingKey, setExpandingKey] = useState(null);
	const [expandingFrame, setExpandingFrame] = useState(null);
	const [pendingAboutNavigation, setPendingAboutNavigation] = useState(false);
	const panelRefs = useRef({});
	const hasHover = useMediaQuery('(hover: hover)');
	const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
	const { members, loading: aboutLoading } = useCompanyProfile();
	const { data: boardPosts } = useApi('/api/public?resource=boardPosts', {
		maxAge: 60 * 1000,
		cacheKey: 'home-board-posts',
	});
	const activeKey = expandingKey || hoveredKey;

	const sections = useMemo(() => SECTIONS, []);
	const recentBoardPosts = useMemo(() => (boardPosts ?? []).slice(0, 3), [boardPosts]);
	const featuredMembers = useMemo(() => members.slice(0, 3), [members]);

	useEffect(() => {
		if (!pendingAboutNavigation || aboutLoading) return;
		navigate('/about');
	}, [aboutLoading, navigate, pendingAboutNavigation]);

	const getExpansionFrame = (section) => {
		const panel = panelRefs.current[section.key];
		if (!panel) return null;

		const rect = panel.getBoundingClientRect();
		const navRect = document.querySelector('.nav-nav')?.getBoundingClientRect();
		const targetTop = Math.max(0, navRect?.bottom ?? 0);
		const targetWidth = Math.max(window.innerWidth - getScrollbarWidth(), 1);
		const targetHeight = Math.max(window.innerHeight - targetTop, 1);
		const isStacked = window.matchMedia('(max-width: 860px)').matches;
		const bounceDistance = isStacked ? 14 : 20;
		let bounceLeft = rect.left;
		let bounceTop = rect.top;
		let bounceWidth = rect.width;
		let bounceHeight = rect.height;

		if (isStacked) {
			if (section.key === 'music') {
				bounceHeight = Math.max(rect.height - bounceDistance, 1);
			} else {
				bounceTop = rect.top + bounceDistance;
				bounceHeight = Math.max(rect.height - bounceDistance, 1);
			}
		} else if (section.key === 'music') {
			bounceWidth = Math.max(rect.width - bounceDistance, 1);
		} else {
			bounceLeft = rect.left + bounceDistance;
			bounceWidth = Math.max(rect.width - bounceDistance, 1);
		}

		return {
			'--portal-start-left': `${rect.left}px`,
			'--portal-start-top': `${rect.top}px`,
			'--portal-start-width': `${rect.width}px`,
			'--portal-start-height': `${rect.height}px`,
			'--portal-bounce-left': `${bounceLeft}px`,
			'--portal-bounce-top': `${bounceTop}px`,
			'--portal-bounce-width': `${bounceWidth}px`,
			'--portal-bounce-height': `${bounceHeight}px`,
			'--portal-target-left': '0px',
			'--portal-target-top': `${targetTop}px`,
			'--portal-target-width': `${targetWidth}px`,
			'--portal-target-height': `${targetHeight}px`,
			'--portal-preview-width': `${targetWidth}px`,
		};
	};

	const enterSection = (section) => {
		if (prefersReducedMotion) {
			navigate(section.path);
			return;
		}

		const nextExpansionFrame = getExpansionFrame(section);
		if (!nextExpansionFrame) {
			navigate(section.path);
			return;
		}

		setExpandingFrame(nextExpansionFrame);
		setExpandingKey(section.key);
		window.setTimeout(() => {
			if (document.startViewTransition) {
				document.startViewTransition(() => {
					flushSync(() => navigate(section.path));
				});
			} else {
				navigate(section.path);
			}
		}, EXPAND_MS);
	};

	const handleAboutClick = (event) => {
		if (!aboutLoading) return;
		event.preventDefault();
		setPendingAboutNavigation(true);
	};

	const handleMoreBelowClick = () => {
		document.querySelector('.portal-about-band')?.scrollIntoView({
			behavior: prefersReducedMotion ? 'auto' : 'smooth',
			block: 'start',
		});
	};

	return (
		<LazyMotion features={domAnimation}>
			<>
				<main className={`portal-home ${expandingKey ? 'portal-home-expanding' : ''}`}>
					{sections.map((section) => {
						const Preview = section.Preview;
						const isActive = activeKey === section.key;
						const isCompressed = activeKey && activeKey !== section.key;

						return (
							<m.div
								key={section.key}
								className={`portal-panel portal-panel-${section.key} ${isActive ? 'portal-panel-active' : ''} ${isCompressed ? 'portal-panel-compressed' : ''}`.trim()}
								ref={(element) => {
									panelRefs.current[section.key] = element;
								}}
								style={expandingKey === section.key && expandingFrame ? expandingFrame : undefined}
								animate={{ flex: isActive ? 1.38 : isCompressed ? 0.62 : 1 }}
								transition={{ duration: 0.46, ease: [0.16, 0.84, 0.26, 1] }}
							>
								<Preview />
								<span className="portal-panel-shade" aria-hidden="true" />
								<span className="portal-panel-content" aria-hidden="true">
									<span className="portal-panel-label">{section.label}</span>
									<span className="portal-panel-description">{section.description}</span>
								</span>
								<button
									type="button"
									className="portal-panel-overlay"
									aria-label={`Enter ${section.label}`}
									onMouseEnter={() => hasHover && !expandingKey && setHoveredKey(section.key)}
									onMouseLeave={() => hasHover && !expandingKey && setHoveredKey(null)}
									onFocus={() => hasHover && !expandingKey && setHoveredKey(section.key)}
									onBlur={() => hasHover && !expandingKey && setHoveredKey(null)}
									onClick={() => enterSection(section)}
								/>
							</m.div>
						);
					})}
					<div className="portal-bottom-bar" aria-label="Scroll to more sections">
						<button type="button" className="portal-bottom-arrow" onClick={handleMoreBelowClick} aria-label="See more below">
							<span aria-hidden="true" />
						</button>
					</div>
				</main>
				<section className="portal-about-band" aria-label="More ASD sections">
					<div className="portal-band-section portal-board-section" aria-labelledby="portal-board-title">
						<div className="portal-band-copy">
							<h2 id="portal-board-title">The Board</h2>
							<Link to="/board" className="portal-band-link">
								Open the board
							</Link>
						</div>
						<div className="portal-board-posts" aria-hidden="true">
							{recentBoardPosts.map((post, index) => (
								<article
									key={post.id}
									className="portal-board-post"
									style={{ '--portal-board-post-index': index, zIndex: 3 - index }}
								>
									{post.imageUrl ? (
										<img src={post.imageUrl} alt="" className="portal-board-post-image" />
									) : (
										<div className="portal-board-post-placeholder">{post.title}</div>
									)}
									<div className="portal-board-post-caption">
										<span>{post.artist?.name || 'ASD'}</span>
										<strong>{post.title}</strong>
									</div>
								</article>
							))}
						</div>
					</div>
					<div className="portal-band-section portal-about-section" aria-labelledby="portal-about-title">
						<div className="portal-band-copy portal-about-copy">
							<h2 id="portal-about-title">About Us</h2>
							<Link
								to="/about"
								className={`portal-band-link portal-about-link ${pendingAboutNavigation ? 'portal-about-link-loading' : ''}`.trim()}
								aria-busy={pendingAboutNavigation ? 'true' : undefined}
								aria-disabled={pendingAboutNavigation ? 'true' : undefined}
								onClick={handleAboutClick}
							>
								Meet the company
							</Link>
						</div>
						<div className="portal-about-portraits" aria-hidden="true">
							{featuredMembers.map((leader, index) => {
								const imageSrc = getCompanyMemberImage(leader);
								return imageSrc ? (
									<img
										key={leader.id}
										src={imageSrc}
										alt=""
										className={`portal-about-portrait portal-about-portrait-${index + 1}`}
									/>
								) : (
									<div
										key={leader.id}
										className={`portal-about-portrait portal-about-portrait-fallback portal-about-portrait-${index + 1}`}
									>
										{getInitials(leader.name)}
									</div>
								);
							})}
						</div>
					</div>
				</section>
			</>
		</LazyMotion>
	);
}
