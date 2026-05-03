import { useEffect, useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { FaChevronLeft, FaChevronRight, FaCompactDisc, FaMicrophoneAlt, FaMusic, FaSignOutAlt, FaUserShield, FaVideo, FaRecordVinyl } from 'react-icons/fa';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import '../../styles/AdminLayout.css';

const ADMIN_SIDEBAR_STATE_KEY = 'admin-sidebar-collapsed';

export default function AdminLayout() {
	const { logout, session } = useAdminAuth();
	const isArtistScoped = session?.role === 'ARTIST';
	const isViewer = session?.role === 'VIEWER';
	const [isCollapsed, setIsCollapsed] = useState(() => {
		if (typeof window === 'undefined') return false;

		try {
			return window.localStorage.getItem(ADMIN_SIDEBAR_STATE_KEY) === 'true';
		} catch {
			return false;
		}
	});

	useEffect(() => {
		if (typeof window === 'undefined') return;
		window.localStorage.setItem(ADMIN_SIDEBAR_STATE_KEY, String(isCollapsed));
	}, [isCollapsed]);

	const links = [
		...(!isArtistScoped && !isViewer ? [
			{ to: '/admin/accounts', label: 'Accounts', icon: <FaUserShield aria-hidden="true" /> },
		] : []),
		...(!isArtistScoped ? [
			{ to: '/admin/artists', label: 'Artists', icon: <FaMicrophoneAlt aria-hidden="true" /> },
		] : []),
		{ to: '/admin/albums', label: 'Albums', icon: <FaCompactDisc aria-hidden="true" /> },
		...(!isViewer ? [{ to: '/admin/videos', label: 'Videos', icon: <FaVideo aria-hidden="true" /> }] : []),
		{ to: '/admin/songs', label: 'Songs', icon: <FaMusic aria-hidden="true" /> },
		...(!isArtistScoped ? [{ to: '/admin/record-player', label: 'Record Player', icon: <FaRecordVinyl aria-hidden="true" /> }] : []),
	];

	return (
		<div className="admin-layout-layout">
			<nav className={`admin-layout-sidebar ${isCollapsed ? 'admin-layout-sidebar-collapsed' : ''}`.trim()}>
				<div className="admin-layout-brand-row">
					<Link to="/" className="admin-layout-brand" title="ASD Records" aria-label="ASD Records home">
						<img src="/favicon.png" alt="" className="admin-layout-brand-icon" />
						<span className="admin-layout-label">ASD Records</span>
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
					{links.map((link) => (
						<NavLink
							key={link.to}
							to={link.to}
							title={link.label}
							aria-label={link.label}
							className={({ isActive }) => isActive ? 'admin-layout-link admin-layout-active' : 'admin-layout-link'}
						>
							<span className="admin-layout-link-icon">{link.icon}</span>
							<span className="admin-layout-label">{link.label}</span>
						</NavLink>
					))}
				</div>
				<button onClick={logout} className="admin-layout-logout" aria-label="Log out" title="Log out">
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
