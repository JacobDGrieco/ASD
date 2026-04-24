import { Link } from 'react-router-dom'
import styles from './ArtistSplash.module.css'

export default function ArtistSplash({ artists }) {
  const heroVideo = import.meta.env.VITE_HOME_HERO_VIDEO || '/hero-video.mp4'

  return (
    <section className={styles.splash}>
      <video
        className={styles.video}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      >
        <source src={heroVideo} type="video/mp4" />
      </video>
      <div className={styles.overlay} />
      <div className={styles.grid}>
        {artists.map((artist) => (
          <Link key={artist.id} to={`/artists/${artist.slug}`} className={styles.card}>
            <img src={artist.portrait} alt={artist.name} className={styles.portrait} />
            <div className={styles.info}>
              <h2 className={styles.name}>{artist.name}</h2>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
