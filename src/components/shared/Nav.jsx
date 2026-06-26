import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import '../../styles/Nav.css';

const SECTION_TABS = {
	music: [
		{ to: '/board', label: 'The Board' },
		{ to: '/videos', label: 'The Stage' },
		{ to: '/crosshair', label: 'The Crosshair' },
	],
	fashion: [
		{ to: '/fashion/talent', label: 'The Talent' },
		{ to: '/fashion/catalogue', label: 'The Catalogue' },
	],
};

const SITE_SECTIONS = [
	{ key: 'music', to: '/music', label: 'Music' },
	{ key: 'fashion', to: '/fashion', label: 'Fashion' },
];

function getSection(pathname) {
	if (pathname === '/music' || pathname.startsWith('/music/') || ['/board', '/videos', '/crosshair'].some((p) => pathname === p || pathname.startsWith(`${p}/`)) || pathname.startsWith('/artists/') || pathname.startsWith('/albums/') || pathname.startsWith('/songs/')) {
		return 'music';
	}
	if (pathname === '/fashion' || pathname.startsWith('/fashion/')) return 'fashion';
	return 'root';
}

function NavContent({ section }) {
	const sectionTabs = SECTION_TABS[section] ?? [];

	return (
		<>
			<Link to="/" className="nav-logo" aria-label="ASD Records home">
				<img src="/favicon.png" alt="" className="nav-logo-mark" />
				<span>ASD RECORDS</span>
			</Link>

			{section === 'root' ? (
				<p className="nav-home-tagline">by the underground, for the unheard.</p>
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
				</>
			)}
		</>
	);
}

export default function Nav() {
	const { pathname } = useLocation();
	const section = getSection(pathname);
	const [renderedSection, setRenderedSection] = useState(section);
	const [exitingSection, setExitingSection] = useState(null);

	useEffect(() => {
		if (section === renderedSection) return undefined;

		setExitingSection(renderedSection);
		setRenderedSection(section);

		const timeoutId = window.setTimeout(() => {
			setExitingSection(null);
		}, 280);

		return () => window.clearTimeout(timeoutId);
	}, [renderedSection, section]);

	return (
		<nav className={`nav-nav nav-${renderedSection}`}>
			{exitingSection && (
				<div className="nav-content-layer nav-content-layer-exiting" aria-hidden="true">
					<NavContent section={exitingSection} />
				</div>
			)}
			<div className={exitingSection ? 'nav-content-layer nav-content-layer-entering' : 'nav-content-layer'}>
				<NavContent section={renderedSection} />
			</div>
		</nav>
	);
}
