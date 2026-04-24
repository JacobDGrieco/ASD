import { Link } from 'react-router-dom'
import { FaApple, FaSoundcloud, FaSpotify } from 'react-icons/fa'
import styles from '../../styles/AlbumCard.module.css'

export default function AlbumCard({ album, isOpen, isUnreleased = false, onClick, to }) {
  const year = new Date(album.releaseDate).getFullYear()
  const className = `${styles.card} ${isOpen ? styles.open : ''}`
  const streamLinks = [
    { href: album.soundcloudUrl, label: 'SoundCloud', icon: FaSoundcloud },
    { href: album.spotifyUrl, label: 'Spotify', icon: FaSpotify },
    { href: album.appleMusicUrl, label: 'Apple Music', icon: FaApple },
  ].filter((link) => link.href)

  const content = (
    <>
      <div className={styles.cover_wrap}>
        {isUnreleased && <span className={styles.ribbon}>Unreleased</span>}
        {album.coverArt ? (
          <img src={album.coverArt} alt={album.title} className={styles.cover} />
        ) : (
          <div className={styles.cover_blank} />
        )}
      </div>
      <div className={styles.info}>
        <span className={styles.title}>{album.title}</span>
        <span className={styles.meta}>{year} · {album.type}</span>
      </div>
    </>
  )

  return (
    <div className={className}>
      {to ? (
        <Link to={to} className={styles.primaryAction}>
          {content}
        </Link>
      ) : onClick ? (
        <button type="button" className={styles.primaryAction} onClick={onClick}>
          {content}
        </button>
      ) : (
        <div className={styles.primaryAction}>
          {content}
        </div>
      )}
      {streamLinks.length > 0 && (
        <div className={styles.streamLinks}>
          {streamLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className={styles.streamLink}
              aria-label={link.label}
              title={link.label}
            >
              <link.icon aria-hidden="true" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
