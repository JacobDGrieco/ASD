import { Link, NavLink } from 'react-router-dom';
import '../../styles/Nav.css';

export default function Nav() {
	return (
		<nav className="nav-nav">
			<Link to="/" className="nav-logo"><img src="/favicon.png" alt="" className="nav-logo-mark" />ASD Records</Link>
			<div className="nav-links">
				<NavLink to="/board" className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}>The Board</NavLink>
				<NavLink to="/videos" className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}>Videos</NavLink>
			</div>
		</nav>
	);
}
