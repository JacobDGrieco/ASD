import { Link } from 'react-router-dom'
import { FaApple, FaSoundcloud, FaSpotify } from 'react-icons/fa'
import SoundCloudPlayer from '../shared/SoundCloudPlayer.jsx'
import styles from '../../styles/SongHeader.module.css'

export default function SongHeader({ song }) {
  const streamLinks = [
    { href: song.soundcloudUrl, label: 'SoundCloud', icon: FaSoundcloud },
    { href: song.spotifyUrl, label: 'Spotify', icon: FaSpotify },
    { href: song.appleMusicUrl, label: 'Apple Music', icon: FaApple },
  ].filter((link) => link.href)

  return (
    <section className={styles.header}>
      <div className={styles.mediaColumn}>
        <div className={styles.art_wrap}>
          {song.album.coverArt
            ? <img src={song.album.coverArt} alt={song.album.title} className={styles.art} />
            : <div className={styles.art_blank} />
          }
        </div>
        {streamLinks.length > 0 && (
          <div className={styles.streamLinks}>
            {streamLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.streamLink}
                aria-label={link.label}
              >
                <link.icon aria-hidden="true" />
              </a>
            ))}
          </div>
        )}
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
