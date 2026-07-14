import { useEffect, useState } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { FaBullseye, FaBullhorn, FaChevronDown, FaChevronLeft, FaChevronRight, FaCompactDisc, FaInfoCircle, FaMicrophoneAlt, FaMusic, FaSignOutAlt, FaUserFriends, FaUserShield, FaVideo, FaRecordVinyl, FaTshirt, FaUsers } from 'react-icons/fa';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import '../../styles/AdminLayout.css';

const ADMIN_SIDEBAR_STATE_KEY = 'admin-sidebar-collapsed';
const ADMIN_SECTION_STATE_KEY = 'admin-sidebar-sections';
const DEFAULT_SECTION_STATE = {
	admin: true,
	board: true,
	music: true,
	fashion: true,
};
const BOARD_LINKS = [
	{ to: '/admin/board', label: 'Posts', icon: <FaBullhorn aria-hidden="true" /> },
];

function readStoredSectionState() {
	if (typeof window === 'undefined') return DEFAULT_SECTION_STATE;

	try {
		const parsed = JSON.parse(window.localStorage.getItem(ADMIN_SECTION_STATE_KEY) || '{}');
		return Object.fromEntries(
			Object.entries(DEFAULT_SECTION_STATE).map(([key, fallback]) => [
				key,
				typeof parsed[key] === 'boolean' ? parsed[key] : fallback,
			]),
		);
	} catch {
		return DEFAULT_SECTION_STATE;
	}
}

function isLinkActive(link, pathname) {
	return pathname === link.to || pathname.startsWith(`${link.to}/`) || link.matchPaths?.some((path) => pathname === path || (path !== '/admin' && pathname.startsWith(`${path}/`)));
}

export default function AdminLayout() {
	const { logout, session } = useAdminAuth();
	const location = useLocation();
	const isArtistScoped = session?.role === 'ARTIST';
	const isViewer = session?.role === 'VIEWER';
	const isSuperAdminSession = session?.role === 'SUPER_ADMIN';
	const [isCollapsed, setIsCollapsed] = useState(() => {
		if (typeof window === 'undefined') return false;

		try {
			return window.localStorage.getItem(ADMIN_SIDEBAR_STATE_KEY) === 'true';
		} catch {
			return false;
		}
	});
	const [openSections, setOpenSections] = useState(readStoredSectionState);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		window.localStorage.setItem(ADMIN_SIDEBAR_STATE_KEY, String(isCollapsed));
	}, [isCollapsed]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		window.localStorage.setItem(ADMIN_SECTION_STATE_KEY, JSON.stringify(openSections));
	}, [openSections]);

	const adminLinks = [
		...(!isArtistScoped && !isViewer ? [
			{ to: '/admin/accounts', label: 'Accounts', icon: <FaUserShield aria-hidden="true" /> },
			{ to: '/admin/about', label: 'About Us', icon: <FaInfoCircle aria-hidden="true" /> },
		] : []),
	];

	const musicLinks = [
		...(!isArtistScoped ? [
			{ to: '/admin/artists', label: 'Artists', icon: <FaMicrophoneAlt aria-hidden="true" />, matchPaths: ['/admin'] },
		] : []),
		...(!isArtistScoped && !isViewer ? [
			{ to: '/admin/outside-artists', label: 'Outside Artists', icon: <FaUserFriends aria-hidden="true" /> },
		] : []),
		{ to: '/admin/albums', label: 'Albums', icon: <FaCompactDisc aria-hidden="true" />, matchPaths: isArtistScoped ? ['/admin'] : undefined },
		{ to: '/admin/songs', label: 'Songs', icon: <FaMusic aria-hidden="true" />, matchPaths: ['/admin/lyrics'] },
		...(!isArtistScoped ? [{ to: '/admin/record-player', label: 'Record Player', icon: <FaRecordVinyl aria-hidden="true" /> }] : []),
		...(!isViewer ? [{ to: '/admin/videos', label: 'Videos', icon: <FaVideo aria-hidden="true" /> }] : []),
		...(isSuperAdminSession ? [{ to: '/admin/crosshair', label: 'Crosshair', icon: <FaBullseye aria-hidden="true" /> }] : []),
	];

	const fashionLinks = [
		...(isSuperAdminSession ? [
			{ to: '/admin/fashion/talent', label: 'Talent', icon: <FaUsers aria-hidden="true" /> },
			{ to: '/admin/fashion/outside_talent', label: 'Outside Talent', icon: <FaUserFriends aria-hidden="true" /> },
			{ to: '/admin/fashion/collections', label: 'Collections', icon: <FaCompactDisc aria-hidden="true" /> },
			{ to: '/admin/fashion/looks', label: 'Looks', icon: <FaTshirt aria-hidden="true" /> },
		] : []),
	];

	const navSections = [
		...(adminLinks.length > 0 ? [{ key: 'admin', label: 'Admin', icon: <FaUserShield aria-hidden="true" />, links: adminLinks }] : []),
		{ key: 'board', label: 'The Board', icon: <FaBullhorn aria-hidden="true" />, links: BOARD_LINKS },
		{ key: 'music', label: 'Music', icon: <FaMusic aria-hidden="true" />, links: musicLinks },
		...(fashionLinks.length > 0 ? [{ key: 'fashion', label: 'Fashion', icon: <FaTshirt aria-hidden="true" />, links: fashionLinks }] : []),
	];

	const toggleSection = (sectionKey) => {
		setOpenSections((current) => ({
			...current,
			[sectionKey]: !(current[sectionKey] ?? true),
		}));
	};

	return (
		<div className="admin-layout-layout">
			<nav className={`admin-layout-sidebar ${isCollapsed ? 'admin-layout-sidebar-collapsed' : ''}`.trim()}>
				<div className="admin-layout-brand-row">
					<Link to="/" className="admin-layout-brand" title="ASD Records" aria-label="ASD Records home">
						<img src="/favicon.png" alt="" className="admin-layout-brand-icon" />
						<span className="admin-layout-label">ASD RECORDS</span>
					</Link>
					<button
						type="button"
						onClick={() => setIsCollapsed((current) => !current)}
						className="admin-layout-collapse-btn"
						aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
						title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
					>
						{isCollapsed ? <FaChevronRight aria-hidden="true" /> : <FaChevronLeft aria-hidden="true" />}
					</button>
				</div>
				<div className="admin-layout-nav">
					{navSections.map((section) => {
						const isOpen = openSections[section.key] ?? true;
						const hasActiveLink = section.links.some((link) => isLinkActive(link, location.pathname));

						return (
							<div
								key={section.key}
								className={`admin-layout-nav-section ${isOpen ? 'admin-layout-nav-section-open' : 'admin-layout-nav-section-closed'} ${hasActiveLink ? 'admin-layout-nav-section-active' : ''}`.trim()}
							>
								<button
									type="button"
									className="admin-layout-section-toggle"
									onClick={() => toggleSection(section.key)}
									aria-expanded={isOpen}
									aria-controls={`admin-layout-section-${section.key}`}
									title={`${isOpen ? 'Close' : 'Open'} ${section.label}`}
								>
									<span className="admin-layout-link-icon">{section.icon}</span>
									<span className="admin-layout-label">{section.label}</span>
									<span className="admin-layout-section-chevron"><FaChevronDown aria-hidden="true" /></span>
								</button>
								{isOpen && (
									<div id={`admin-layout-section-${section.key}`} className="admin-layout-nav-section-links">
										{section.links.map((link) => (
											<NavLink
												key={link.to}
												to={link.to}
												title={link.label}
												aria-label={link.label}
												className={({ isActive }) => (isActive || isLinkActive(link, location.pathname)) ? 'admin-layout-link admin-layout-active' : 'admin-layout-link'}
											>
												<span className="admin-layout-link-icon">{link.icon}</span>
												<span className="admin-layout-label">{link.label}</span>
											</NavLink>
										))}
									</div>
								)}
							</div>
						);
					})}
				</div>
				<button type="button" onClick={logout} className="admin-layout-logout" aria-label="Log out" title="Log out">
					<span className="admin-layout-link-icon"><FaSignOutAlt aria-hidden="true" /></span>
					<span className="admin-layout-label">Log out</span>
				</button>
			</nav>
			<main className="admin-layout-main">
				<Outlet />
			</main>
		</div>
	);
}
