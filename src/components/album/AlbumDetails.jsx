import '../../styles/AlbumDetails.css'

export default function AlbumDetails({ album }) {
  const releaseDate = album?.releaseDate
    ? new Date(album.releaseDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : null

  const details = [
    { label: 'Artist', value: album?.artist?.name },
    { label: 'Type', value: formatAlbumType(album?.type) },
    { label: 'Release date', value: releaseDate },
    { label: 'Tracks', value: album?.songs?.length ? String(album.songs.length) : null },
  ].filter((detail) => detail.value)

  return (
    <section className="album-details-section">
      {album?.aboutText && (
        <div className="album-details-copy">
          <h2 className="album-details-heading">About</h2>
          <p className="album-details-text">{album.aboutText}</p>
        </div>
      )}

      {details.length > 0 && (
        <div className="album-details-meta">
          <h2 className="album-details-heading">Info</h2>
          <div className="album-details-list">
            {details.map((detail) => (
              <div key={detail.label} className="album-details-row">
                <span className="album-details-label">{detail.label}</span>
                <span className="album-details-value">{detail.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!album?.aboutText && details.length === 0 && (
        <p className="album-details-empty">More album information will show up here.</p>
      )}
    </section>
  )
}

function formatAlbumType(type) {
  if (!type) return null
  return type.charAt(0) + type.slice(1).toLowerCase()
}
