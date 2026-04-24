import { Outlet, NavLink } from 'react-router-dom'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import styles from './AdminLayout.module.css'

export default function AdminLayout() {
  const { logout } = useAdminAuth()
  return (
    <div className={styles.layout}>
      <nav className={styles.sidebar}>
        <div className={styles.brand}>ASD Admin</div>
        <NavLink to="/admin/artists" className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>Artists</NavLink>
        <NavLink to="/admin/albums" className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>Albums</NavLink>
        <NavLink to="/admin/songs" className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>Songs</NavLink>
        <NavLink to="/admin/record-player" className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>Record Player</NavLink>
        <button onClick={logout} className={styles.logout}>Log out</button>
      </nav>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
