import '../../styles/SongInfoLinks.css'
import { Link } from 'react-router-dom'

export default function SongInfoLinks({ song }) {
  const meta = song.meta
  const hasInfo = Boolean(meta?.producers || meta?.writers || meta?.featuredArtists || meta?.tags?.length)

  if (!hasInfo) {
    return null
  }

  return (
    <section className="song-info-links-section">
      {meta?.producers && <InfoRow label="Produced by" links={meta.producerLinks} value={meta.producers} />}
      {meta?.writers && <InfoRow label="Written by" links={meta.writerLinks} value={meta.writers} />}
      {meta?.featuredArtists && <InfoRow label="Featuring" links={meta.featuredArtistLinks} value={meta.featuredArtists} />}
      {meta?.tags?.length > 0 && <TagRow label="Tags" tags={meta.tags} />}
    </section>
  )
}

function InfoRow({ label, links, value }) {
  const items = Array.isArray(links) && links.length > 0
    ? links
    : value
      ? value.split(';').map((name) => ({ name: name.trim(), slug: null })).filter((item) => item.name)
      : []

  return (
    <div className="song-info-links-row">
      <span className="song-info-links-label">{label}</span>
      <span className="song-info-links-value">
        {items.map((item, index) => (
          <span key={`${label}-${item.name}`}>
            {index > 0 && ', '}
            {item.slug ? <Link to={`/artists/${item.slug}`}>{item.name}</Link> : item.name}
          </span>
        ))}
      </span>
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
