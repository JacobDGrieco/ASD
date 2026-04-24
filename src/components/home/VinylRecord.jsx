import styles from '../../styles/VinylRecord.module.css'

export default function VinylRecord({ track, isActive, onClick }) {
  return (
    <button
      className={`${styles.record} ${isActive ? styles.active : ''}`}
      onClick={onClick}
      aria-label={track.song.title}
    >
      <div className={styles.sleeve}>
        <img src={track.song.album.coverArt} alt={track.song.album.title} className={styles.art} />
      </div>
      <div className={styles.meta}>
        <span className={styles.title}>{track.song.title}</span>
        <span className={styles.artist}>{track.song.album.artist.name}</span>
      </div>
    </button>
  )
}
