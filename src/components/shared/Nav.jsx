import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import '../../styles/Nav.css';

export default function Nav() {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const handleScroll = () => setScrolled(window.scrollY > 40);
		handleScroll();
		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	return (
		<nav className={scrolled ? 'nav-nav nav-scrolled' : 'nav-nav'}>
			<Link to="/" className="nav-logo"><img src="/favicon.png" alt="" className="nav-logo-mark" />ASD RECORDS</Link>
			<div className="nav-links">
				<NavLink to="/board" className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}>THE BOARD</NavLink>
				<NavLink to="/videos" className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}>THE STAGE</NavLink>
			</div>
		</nav>
	);
}
