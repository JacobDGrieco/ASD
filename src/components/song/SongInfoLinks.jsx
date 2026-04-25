import '../../styles/SongInfoLinks.css'

export default function SongInfoLinks({ song }) {
  const meta = song.meta
  const hasInfo = Boolean(meta?.producers || meta?.writers || meta?.featuredArtists || meta?.tags?.length)

  if (!hasInfo) {
    return null
  }

  return (
    <section className="song-info-links-section">
      {meta?.producers && <InfoRow label="Produced by" value={meta.producers} />}
      {meta?.writers && <InfoRow label="Written by" value={meta.writers} />}
      {meta?.featuredArtists && <InfoRow label="Featuring" value={meta.featuredArtists} />}
      {meta?.tags?.length > 0 && <TagRow label="Tags" tags={meta.tags} />}
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

function TagRow({ label, tags }) {
  return (
    <div className="song-info-links-row">
      <span className="song-info-links-label">{label}</span>
      <div className="song-info-links-tags">
        {tags.map((tag) => (
          <span key={tag} className="song-info-links-tag">{tag}</span>
        ))}
      </div>
    </div>
  )
}
