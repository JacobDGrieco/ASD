import styles from './SongInfoLinks.module.css'

export default function SongInfoLinks({ song }) {
  const meta = song.meta
  return (
    <section className={styles.section}>
      {meta?.producers && <InfoRow label="Produced by" value={meta.producers} />}
      {meta?.writers && <InfoRow label="Written by" value={meta.writers} />}
      <div className={styles.links}>
        {song.soundcloudUrl && <a href={song.soundcloudUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>SoundCloud</a>}
        {song.spotifyUrl && <a href={song.spotifyUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>Spotify</a>}
        {song.appleMusicUrl && <a href={song.appleMusicUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>Apple Music</a>}
      </div>
    </section>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  )
}
