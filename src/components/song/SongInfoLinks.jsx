import '../../styles/SongInfoLinks.css'
import { Link } from 'react-router-dom'
import { SONG_ROLES, ROLE_DISPLAY_LABELS } from '../../lib/songRoles.js'

export default function SongInfoLinks({ song }) {
  const meta = song.meta ?? {}
  const roleGroups = meta?.roleGroups ?? {}
  const roleRows = SONG_ROLES
    .filter((role) => roleGroups[role]?.length)
    .map((role) => ({ label: ROLE_DISPLAY_LABELS[role], links: roleGroups[role] }))
  const releaseDate = meta.releaseDate
    ? new Date(meta.releaseDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : null
  const basicRows = [
    { label: 'Length', value: song.duration },
    { label: 'BPM', value: meta.bpm },
    { label: 'Key', value: meta.key },
    { label: 'Release date', value: releaseDate },
    { label: 'Genre', value: meta.genre },
  ].filter((row) => row.value)
  const hasAboutInfo = Boolean(meta.aboutText)
  const hasBasicInfo = basicRows.length > 0 || meta.tags?.length > 0
  const hasPeopleInfo = roleRows.length > 0

  if (!hasAboutInfo && !hasBasicInfo && !hasPeopleInfo) return null

  return (
    <section className="song-info-links-section">
      {hasAboutInfo && (
        <div className="song-info-links-block">
          <h2 className="song-info-links-heading">About</h2>
          <p className="song-info-links-about">{meta.aboutText}</p>
        </div>
      )}
      {hasBasicInfo && (
        <div className="song-info-links-block">
          <h2 className="song-info-links-heading">Song Details</h2>
          {basicRows.length > 0 && (
            <div className="song-info-links-list">
              {basicRows.map((row) => (
                <InfoRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          )}
          {meta.tags?.length > 0 && <TagRow label="Tags" tags={meta.tags} />}
        </div>
      )}
      {hasPeopleInfo && (
        <div className="song-info-links-block">
          <h2 className="song-info-links-heading">People & Roles</h2>
          <div className="song-info-links-list">
            {roleRows.map((row) => (
              <InfoRow key={row.label} label={row.label} links={row.links} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function InfoRow({ label, value, links }) {
  return (
    <div className="song-info-links-row">
      <span className="song-info-links-label">{label}</span>
      <span className="song-info-links-value">
        {links
          ? links.map((item, index) => (
              <span key={`${label}-${item.name}`}>
                {index > 0 && ', '}
                {item.slug ? <Link to={`/artists/${item.slug}`}>{item.name}</Link> : item.name}
              </span>
            ))
          : value}
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
