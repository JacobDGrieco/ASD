import { Link } from 'react-router-dom';
import styles from '../../styles/Nav.module.css';

export default function Nav() {
	return (
		<nav className={styles.nav}>
			<Link to="/" className={styles.logo} style={{ display: "flex", alignItems: "center", gap: "12px" }}><img src="/favicon.png" style={{ width: "50px" }} />ASD Records</Link>
		</nav>
	);
}
