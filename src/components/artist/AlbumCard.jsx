import styles from './AlbumCard.module.css'

export default function AlbumCard({ album, isOpen, onClick }) {
  const year = new Date(album.releaseDate).getFullYear()
  return (
    <button className={`${styles.card} ${isOpen ? styles.open : ''}`} onClick={onClick}>
      <div className={styles.cover_wrap}>
        {album.coverArt
          ? <img src={album.coverArt} alt={album.title} className={styles.cover} />
          : <div className={styles.cover_blank} />
        }
      </div>
      <div className={styles.info}>
        <span className={styles.title}>{album.title}</span>
        <span className={styles.meta}>{year} · {album.type}</span>
      </div>
    </button>
  )
}
