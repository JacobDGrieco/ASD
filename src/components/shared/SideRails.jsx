import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import '../../styles/SideRails.css';

const LEFT_RAIL_TEXT = Array.from({ length: 18 }, (_, index) => `left-${index}`);
const MUSIC_FALLBACK_NAMES = ['Aim', 'ben das', 'certo1k', 'notfaave', 'addisonnn'];
const FASHION_FALLBACK_NAMES = ['Models', 'Designers', 'Stylists', 'Photographers', 'Editors'];
const RIGHT_RAIL_COUNT = 24;
const RIGHT_RAIL_ROTATE_MS = 60 * 1000;
const RIGHT_RAIL_TRANSITION_MS = 760;

function getPublicSection(pathname) {
	if (pathname === '/fashion' || pathname.startsWith('/fashion/')) return 'fashion';
	if (
		pathname === '/music' ||
		pathname.startsWith('/music/') ||
		['/board', '/videos', '/crosshair'].some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
		pathname.startsWith('/artists/') ||
		pathname.startsWith('/albums/') ||
		pathname.startsWith('/songs/')
	) {
		return 'music';
	}

	return null;
}

function getRightRailNames(names, startIndex) {
	if (!names.length) return [];
	return Array.from({ length: RIGHT_RAIL_COUNT }, (_, index) => names[(startIndex + index) % names.length]);
}

function getDisplayNames(rows, fallbackNames) {
	const names = (Array.isArray(rows) ? rows : []).reduce((displayNames, row) => {
		const name = row?.name;
		if (typeof name === 'string' && name.trim()) displayNames.push(name.trim());
		return displayNames;
	}, []);

	return names.length ? names : fallbackNames;
}

export default function SideRails() {
	const location = useLocation();
	const section = getPublicSection(location.pathname);

	const prevSectionRef = useRef(section);
	const [displaySection, setDisplaySection] = useState(section);
	const [isHiding, setIsHiding] = useState(false);

	useEffect(() => {
		const prev = prevSectionRef.current;

		// Only animate section-to-section (both must be non-null and different)
		if (!section || !prev || section === prev) return undefined;

		// Fade out immediately
		setIsHiding(true);

		// Swap content after old rails are fully gone (t=0.5s)
		const switchTimer = setTimeout(() => {
			prevSectionRef.current = section;
			setDisplaySection(section);
		}, 500);

		// Fade in with new content (t=1.0s)
		const showTimer = setTimeout(() => {
			setIsHiding(false);
		}, 1000);

		return () => {
			clearTimeout(switchTimer);
			clearTimeout(showTimer);
		};
	}, [section]);

	// Prefetch both sections simultaneously so data is in cache before any transition swap
	const { data: musicRailRows } = useApi(section !== null ? '/api/artists' : null);
	const { data: fashionRailRows } = useApi(section !== null ? '/api/fashion/talent' : null);

	// All content derives from displaySection so it only changes mid-transition
	const fallbackNames = displaySection === 'fashion' ? FASHION_FALLBACK_NAMES : MUSIC_FALLBACK_NAMES;
	const railRows = displaySection === 'music' ? musicRailRows : displaySection === 'fashion' ? fashionRailRows : null;
	const rightRailSourceNames = useMemo(
		() => getDisplayNames(railRows, fallbackNames),
		[fallbackNames, railRows]
	);
	const [rightRailState, setRightRailState] = useState({
		currentIndex: 0,
		previousIndex: null,
		transitionKey: 0,
	});

	useEffect(() => {
		setRightRailState({
			currentIndex: 0,
			previousIndex: null,
			transitionKey: 0,
		});
	}, [displaySection, rightRailSourceNames.length]);

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			setRightRailState((current) => ({
				currentIndex: (current.currentIndex + 1) % rightRailSourceNames.length,
				previousIndex: current.currentIndex,
				transitionKey: current.transitionKey + 1,
			}));
		}, RIGHT_RAIL_ROTATE_MS);

		return () => window.clearInterval(intervalId);
	}, [rightRailSourceNames.length]);

	useEffect(() => {
		if (rightRailState.previousIndex === null) return undefined;

		const timeoutId = window.setTimeout(() => {
			setRightRailState((current) => (
				current.transitionKey === rightRailState.transitionKey
					? { ...current, previousIndex: null }
					: current
			));
		}, RIGHT_RAIL_TRANSITION_MS);

		return () => window.clearTimeout(timeoutId);
	}, [rightRailState.previousIndex, rightRailState.transitionKey]);

	const currentRightRailNames = useMemo(
		() => getRightRailNames(rightRailSourceNames, rightRailState.currentIndex),
		[rightRailSourceNames, rightRailState.currentIndex]
	);

	const previousRightRailNames = useMemo(
		() => rightRailState.previousIndex === null ? [] : getRightRailNames(rightRailSourceNames, rightRailState.previousIndex),
		[rightRailSourceNames, rightRailState.previousIndex]
	);

	if (!section || location.pathname.startsWith('/admin')) return null;

	return (
		<div className={`side-rails${isHiding ? ' side-rails-hiding' : ''}`} aria-hidden="true">
			<div className="side-rails-rail side-rails-rail-left">
				<div className="side-rails-column side-rails-column-left">
					{LEFT_RAIL_TEXT.map((key) => (
						<span key={key} className="side-rails-text" data-text="A.S.D.">
							<span className="side-rails-text-outline">A.S.D.</span>
						</span>
					))}
				</div>
			</div>
			<div className="side-rails-rail side-rails-rail-right">
				<div className="side-rails-right-stack">
					{rightRailState.previousIndex !== null && (
						<div
							key={`right-exit-${rightRailState.transitionKey}`}
							className="side-rails-column side-rails-column-right side-rails-column-right-exit"
						>
							{previousRightRailNames.map((name, index) => (
								<span key={`right-prev-${rightRailState.transitionKey}-${index}`} className="side-rails-text" data-text={name}>
									<span className="side-rails-text-outline">{name}</span>
								</span>
							))}
						</div>
					)}
					<div
						key={`right-current-${rightRailState.currentIndex}-${rightRailState.transitionKey}`}
						className={`side-rails-column side-rails-column-right ${rightRailState.previousIndex !== null ? 'side-rails-column-right-enter' : ''}`.trim()}
					>
						{currentRightRailNames.map((name, index) => (
							<span key={`right-current-${rightRailState.currentIndex}-${index}`} className="side-rails-text" data-text={name}>
								<span className="side-rails-text-outline">{name}</span>
							</span>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
