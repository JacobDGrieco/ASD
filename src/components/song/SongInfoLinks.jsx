import '../../styles/SongInfoLinks.css'

export default function SongInfoLinks({ song }) {
  const meta = song.meta
  const hasInfo = Boolean(meta?.producers || meta?.writers)

  if (!hasInfo) {
    return null
  }

  return (
    <section className="song-info-links-section">
      {meta?.producers && <InfoRow label="Produced by" value={meta.producers} />}
      {meta?.writers && <InfoRow label="Written by" value={meta.writers} />}
    </section>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="song-info-links-row">
      <span className="song-info-links-label">{label}</span>
      <span className="song-info-links-value">{value}</span>
    </div>
  )
}
