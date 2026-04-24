import { Link } from 'react-router-dom'
import styles from './TrackList.module.css'

export default function TrackList({ songs }) {
  return (
    <div className={styles.list}>
      {songs.map((song) => (
        <Link key={song.id} to={`/songs/${song.slug}`} className={styles.row}>
          <span className={styles.num}>{song.discNumber > 1 ? `${song.discNumber}-` : ''}{song.trackNumber}</span>
          <span className={styles.title}>{song.title}</span>
          <span className={styles.duration}>{song.duration}</span>
        </Link>
      ))}
    </div>
  )
}
