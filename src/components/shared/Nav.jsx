/**
 * Shared public navigation shell.
 *
 * Handles section-aware links, mobile menu state, and admin-preview affordances in
 * public layouts.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { FaBullhorn, FaChevronDown, FaCompactDisc, FaHome, FaInfoCircle, FaMusic, FaTshirt, FaUserFriends } from 'react-icons/fa';
import '../../styles/Nav.css';

const NAV_GROUPS = [
	{
		key: 'extras',
		label: 'Home',
		to: '/',
		cards: [
			{ to: '/', label: 'A.S.D.', description: 'The main entrance.', icon: FaHome },
			{ to: '/board', label: 'The Board', description: 'Announcements and pinned posts.', icon: FaBullhorn },
			{ to: '/about', label: 'About', description: 'Company notes and credits.', icon: FaInfoCircle },
		],
	},
	{
		key: 'music',
		label: 'Music',
		to: '/music',
		cards: [
			{ to: '/music', label: 'Music Home', description: 'Records, artists, and releases.', icon: FaHome },
			{ to: '/shelf', label: 'The Shelf', description: 'Albums, singles, and EPs.', icon: FaCompactDisc },
			{ to: '/crosshair', label: 'The Crosshair', description: 'Videos and visual drops.', icon: FaMusic },
		],
	},
	{
		key: 'fashion',
		label: 'Fashion',
		to: '/fashion',
		cards: [
			{ to: '/fashion', label: 'Fashion Home', description: 'Runway, styling, and editorial work.', icon: FaHome },
			{ to: '/fashion/catalogue', label: 'The Catalogue', description: 'Collections and loose looks.', icon: FaTshirt },
			{ to: '/fashion/talent', label: 'The Talent', description: 'Models, stylists, and collaborators.', icon: FaUserFriends },
		],
	},
];

function getSection(pathname) {
	if (pathname === '/music' || pathname.startsWith('/music/') || ['/shelf', '/crosshair'].some((path) => pathname === path || pathname.startsWith(`${path}/`)) || pathname.startsWith('/artists/') || pathname.startsWith('/albums/') || pathname.startsWith('/songs/')) {
		return 'music';
	}
	if (pathname === '/fashion' || pathname.startsWith('/fashion/')) return 'fashion';
	return 'extras';
}

function NavCard({ card, onNavigate }) {
	const Icon = card.icon;

	return (
		<NavLink
			to={card.to}
			className={({ isActive }) => (isActive ? 'nav-card nav-card-active' : 'nav-card')}
			onClick={onNavigate}
		>
			<span className="nav-card-icon" aria-hidden="true">
				<Icon />
			</span>
			<span className="nav-card-copy">
				<span className="nav-card-title">{card.label}</span>
				<span className="nav-card-description">{card.description}</span>
			</span>
		</NavLink>
	);
}

export default function Nav() {
	const { pathname } = useLocation();
	const activeSection = getSection(pathname);
	const [isOpen, setIsOpen] = useState(false);
	const navRef = useRef(null);

	useEffect(() => {
		setIsOpen(false);
	}, [pathname]);

	useEffect(() => {
		if (!isOpen) return undefined;

		const handlePointerDown = (event) => {
			if (!navRef.current?.contains(event.target)) setIsOpen(false);
		};

		const handleKeyDown = (event) => {
			if (event.key === 'Escape') setIsOpen(false);
		};

		document.addEventListener('mousedown', handlePointerDown);
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [isOpen]);

	return (
		<nav
			ref={navRef}
			className={`nav-nav nav-cardnav nav-${activeSection}${isOpen ? ' nav-cardnav-open' : ''}`}
		>
			<div className="nav-cardnav-bar">
				<Link to="/" className="nav-logo" aria-label="A.S.D. home" onClick={() => setIsOpen(false)}>
					<img src="/favicon.png" alt="" className="nav-logo-mark" />
					<span>A.S.D.</span>
				</Link>

				<div className="nav-cardnav-main" aria-label="Main navigation">
					{NAV_GROUPS.map((group) => (
						<NavLink
							key={group.key}
							to={group.to}
							className={`nav-cardnav-trigger${activeSection === group.key ? ' nav-cardnav-trigger-active' : ''}`}
							onClick={() => setIsOpen(false)}
						>
							{group.label}
						</NavLink>
					))}
					<button
						type="button"
						className="nav-cardnav-toggle"
						onClick={() => setIsOpen((current) => !current)}
						aria-label={isOpen ? 'Close navigation cards' : 'Open navigation cards'}
						aria-expanded={isOpen}
						aria-controls="site-cardnav-panel"
					>
						<FaChevronDown aria-hidden="true" />
					</button>
				</div>
				<div className="nav-cardnav-spacer" aria-hidden="true" />
			</div>

			<div
				id="site-cardnav-panel"
				className="nav-cardnav-panel"
				aria-hidden={!isOpen}
			>
				<div className="nav-cardnav-panel-inner">
					{NAV_GROUPS.map((group) => (
						<section
							key={group.key}
							className={`nav-cardnav-group${activeSection === group.key ? ' nav-cardnav-group-active' : ''}`}
							aria-label={`${group.label} pages`}
						>
							<div className="nav-cardnav-group-heading">
								<span>{group.label}</span>
							</div>
							<div className="nav-cardnav-cards">
								{group.cards.map((card) => (
									<NavCard key={card.to} card={card} onNavigate={() => setIsOpen(false)} />
								))}
							</div>
						</section>
					))}
				</div>
			</div>
		</nav>
	);
}
