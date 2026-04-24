import { Link } from 'react-router-dom';
import styles from './Nav.module.css';

export default function Nav() {
	return (
		<nav className={styles.nav}>
			<Link to="/" className={styles.logo}>ASD Records</Link>
		</nav>
	);
}
