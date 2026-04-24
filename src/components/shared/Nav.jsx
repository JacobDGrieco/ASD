import { Link } from 'react-router-dom';
import '../../styles/Nav.css'

export default function Nav() {
	return (
		<nav className="nav-nav">
			<Link to="/" className="nav-logo" style={{ display: "flex", alignItems: "center", gap: "12px" }}><img src="/favicon.png" style={{ width: "50px" }} />ASD Records</Link>
		</nav>
	);
}
