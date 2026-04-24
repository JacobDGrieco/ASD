import styles from '../../styles/SongInfoLinks.module.css'

export default function SongInfoLinks({ song }) {
  const meta = song.meta
  const hasInfo = Boolean(meta?.producers || meta?.writers)

  if (!hasInfo) {
    return null
  }

  return (
    <section className={styles.section}>
      {meta?.producers && <InfoRow label="Produced by" value={meta.producers} />}
      {meta?.writers && <InfoRow label="Written by" value={meta.writers} />}
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
