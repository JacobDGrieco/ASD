import { Link } from 'react-router-dom'
import SoundCloudPlayer from '../shared/SoundCloudPlayer.jsx'
import styles from './SongHeader.module.css'

export default function SongHeader({ song }) {
  return (
    <section className={styles.header}>
      <div className={styles.art_wrap}>
        {song.album.coverArt
          ? <img src={song.album.coverArt} alt={song.album.title} className={styles.art} />
          : <div className={styles.art_blank} />
        }
      </div>
      <div className={styles.info}>
        <Link to={`/artists/${song.album.artist.slug}`} className={styles.artist_link}>
          {song.album.artist.name}
        </Link>
        <h1 className={styles.title}>{song.title}</h1>
        <p className={styles.meta}>
          <Link to={`/artists/${song.album.artist.slug}`}>{song.album.title}</Link>
          {song.meta?.releaseDate && ` · ${new Date(song.meta.releaseDate).getFullYear()}`}
          {song.duration && ` · ${song.duration}`}
        </p>
        {song.soundcloudUrl && (
          <div className={styles.player}>
            <SoundCloudPlayer url={song.soundcloudUrl} autoPlay={false} />
          </div>
        )}
      </div>
    </section>
  )
}
