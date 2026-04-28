import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import '../../styles/AdminLayout.css';

export default function AdminLayout() {
	const { logout, session } = useAdminAuth();
	const isArtistScoped = session?.role === 'ARTIST';

	return (
		<div className="admin-layout-layout">
			<nav className="admin-layout-sidebar">
				<Link to="/" className="admin-layout-brand">ASD Records</Link>
				{!isArtistScoped && <NavLink to="/admin/accounts" className={({ isActive }) => isActive ? `admin-layout-link admin-layout-active` : 'admin-layout-link'}>Accounts</NavLink>}
				{!isArtistScoped && <NavLink to="/admin/artists" className={({ isActive }) => isActive ? `admin-layout-link admin-layout-active` : 'admin-layout-link'}>Artists</NavLink>}
				<NavLink to="/admin/albums" className={({ isActive }) => isActive ? `admin-layout-link admin-layout-active` : 'admin-layout-link'}>Albums</NavLink>
				<NavLink to="/admin/videos" className={({ isActive }) => isActive ? `admin-layout-link admin-layout-active` : 'admin-layout-link'}>Videos</NavLink>
				<NavLink to="/admin/songs" className={({ isActive }) => isActive ? `admin-layout-link admin-layout-active` : 'admin-layout-link'}>Songs</NavLink>
				{!isArtistScoped && <NavLink to="/admin/record-player" className={({ isActive }) => isActive ? `admin-layout-link admin-layout-active` : 'admin-layout-link'}>Record Player</NavLink>}
				<button onClick={logout} className="admin-layout-logout">Log out</button>
			</nav>
			<main className="admin-layout-main">
				<Outlet />
			</main>
		</div>
	);
}
