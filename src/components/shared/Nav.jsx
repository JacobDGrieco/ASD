import { useEffect, useReducer, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import '../../styles/Nav.css';

const SECTION_TABS = {
	music: [
		{ to: '/shelf', label: 'The Shelf' },
		{ to: '/crosshair', label: 'The Crosshair' },
	],
	fashion: [
		{ to: '/fashion/catalogue', label: 'The Catalogue' },
		{ to: '/fashion/talent', label: 'The Talent' },
	],
};

const SITE_SECTIONS = [
	{ key: 'music', to: '/music', label: 'Music' },
	{ key: 'fashion', to: '/fashion', label: 'Fashion' },
];

function getSection(pathname) {
	if (pathname === '/music' || pathname.startsWith('/music/') || ['/shelf', '/crosshair'].some((p) => pathname === p || pathname.startsWith(`${p}/`)) || pathname.startsWith('/artists/') || pathname.startsWith('/albums/') || pathname.startsWith('/songs/')) {
		return 'music';
	}
	if (pathname === '/fashion' || pathname.startsWith('/fashion/')) return 'fashion';
	return 'root';
}

function NavContent({ section }) {
	const sectionTabs = SECTION_TABS[section] ?? [];
	const globalActions = (
		<div className="nav-global-actions" aria-label="Global navigation">
			<NavLink
				to="/board"
				className={({ isActive }) => isActive ? 'nav-board-link nav-board-link-active' : 'nav-board-link'}
			>
				The Board
			</NavLink>
			{section !== 'root' && (
				<div className="nav-section-switch" aria-label="Site sections">
					{SITE_SECTIONS.map((siteSection) => (
						<Link
							key={siteSection.key}
							to={siteSection.to}
							className={section === siteSection.key ? 'nav-section-link nav-section-link-active' : 'nav-section-link'}
							aria-current={section === siteSection.key ? 'page' : undefined}
						>
							{siteSection.label}
						</Link>
					))}
				</div>
			)}
		</div>
	);

	return (
		<>
			<Link to="/" className="nav-logo" aria-label="A.S.D. home">
				<img src="/favicon.png" alt="" className="nav-logo-mark" />
				<span>A.S.D.</span>
			</Link>

			{section === 'root' ? (
				<>
					<p className="nav-home-tagline">by the underground, for the unheard.</p>
					{globalActions}
				</>
			) : (
				<>
					<div className="nav-links" aria-label={`${section} navigation`}>
						{sectionTabs.map((tab) => (
							<NavLink
								key={tab.to}
								to={tab.to}
								className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}
							>
								{tab.label}
							</NavLink>
						))}
					</div>
					{globalActions}
				</>
			)}
		</>
	);
}

function transitionStateReducer(state, action) {
	switch (action.type) {
		case 'start':
			return {
				exitingSection: action.exitingSection,
				isTransitioning: true,
				transitionKey: state.transitionKey + 1,
			};
		case 'clearExit':
			return { ...state, exitingSection: null };
		case 'finish':
			return { ...state, isTransitioning: false };
		default:
			return state;
	}
}

export default function Nav() {
	const { pathname } = useLocation();
	const section = getSection(pathname);

	// Ref instead of state so updating it doesn't re-trigger this effect and cancel the timers
	const renderedSectionRef = useRef(section);
	const [{ exitingSection, isTransitioning, transitionKey }, dispatchTransitionState] = useReducer(
		transitionStateReducer,
		{ exitingSection: null, isTransitioning: false, transitionKey: 0 }
	);

	useEffect(() => {
		if (section === renderedSectionRef.current) return undefined;

		dispatchTransitionState({ type: 'start', exitingSection: renderedSectionRef.current });
		renderedSectionRef.current = section;

		const exitTimer = window.setTimeout(() => dispatchTransitionState({ type: 'clearExit' }), 500);
		const enterTimer = window.setTimeout(() => dispatchTransitionState({ type: 'finish' }), 1600);

		return () => {
			window.clearTimeout(exitTimer);
			window.clearTimeout(enterTimer);
		};
	}, [section]);

	return (
		<nav className={`nav-nav nav-${renderedSectionRef.current}`}>
			{exitingSection && (
				<div className="nav-content-layer nav-content-layer-exiting" aria-hidden="true">
					<NavContent section={exitingSection} />
				</div>
			)}
			<div
				key={transitionKey}
				className={isTransitioning ? 'nav-content-layer nav-content-layer-entering' : 'nav-content-layer'}
			>
				<NavContent section={renderedSectionRef.current} />
			</div>
		</nav>
	);
}
