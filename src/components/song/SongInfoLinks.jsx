import '../../styles/SongInfoLinks.css'
import { Link } from 'react-router-dom'
import { SONG_ROLES, ROLE_DISPLAY_LABELS } from '../../lib/songRoles.js'

export default function SongInfoLinks({ song }) {
  const meta = song.meta
  const roleGroups = meta?.roleGroups ?? {}
  const hasRoles = SONG_ROLES.some((role) => roleGroups[role]?.length)
  const hasInfo = hasRoles || meta?.tags?.length

  if (!hasInfo) return null

  return (
    <section className="song-info-links-section">
      {SONG_ROLES
        .filter((role) => roleGroups[role]?.length)
        .map((role) => (
          <InfoRow key={role} label={ROLE_DISPLAY_LABELS[role]} links={roleGroups[role]} />
        ))}
      {meta?.tags?.length > 0 && <TagRow label="Tags" tags={meta.tags} />}
    </section>
  )
}

function InfoRow({ label, links }) {
  return (
    <div className="song-info-links-row">
      <span className="song-info-links-label">{label}</span>
      <span className="song-info-links-value">
        {links.map((item, index) => (
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
