import '../../styles/VinylRecord.css'

export default function VinylRecord({ track, isActive, onClick, imagePriority = 'auto', shouldEagerLoad = false }) {
  return (
    <button
      type="button"
      className={`vinyl-record-record ${isActive ? 'vinyl-record-active' : ''}`}
      onClick={onClick}
      aria-label={track.song.title}
    >
      <div className="vinyl-record-sleeve">
        <img
          src={track.song.album.coverArt}
          alt={track.song.album.title}
          className="vinyl-record-art"
          loading={shouldEagerLoad ? 'eager' : 'lazy'}
          fetchPriority={imagePriority}
          decoding="async"
        />
      </div>
      <div className="vinyl-record-meta">
        <span className="vinyl-record-title">{track.song.title}</span>
        <span className="vinyl-record-artist">{track.song.album.artist.name}</span>
      </div>
    </button>
  )
}
