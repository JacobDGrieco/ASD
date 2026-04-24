import { Link } from 'react-router-dom'
import styles from './ArtistSplash.module.css'

export default function ArtistSplash({ artists }) {
  return (
    <section className={styles.splash}>
      <div className={styles.grid}>
        {artists.map((artist) => (
          <Link key={artist.id} to={`/artists/${artist.slug}`} className={styles.card}>
            <img src={artist.portrait} alt={artist.name} className={styles.portrait} />
            <div className={styles.info}>
              <h2 className={styles.name}>{artist.name}</h2>
              <p className={styles.bio}>{artist.bio}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
