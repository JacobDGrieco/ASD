import '../../styles/AlbumCard.css'

export default function CollectionCard({ collection, isOpen, onClick }) {
  const coverImg = collection.coverImage
  const lookCount = collection.looks?.length ?? 0
  const meta = [
    collection.season,
    `${lookCount} look${lookCount === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' - ')

  return (
    <div className={`album-card-card${isOpen ? ' album-card-open' : ''}`}>
      <button type="button" className="album-card-primary-action" onClick={onClick}>
        <div className="album-card-cover-wrap">
          {coverImg ? (
            <img
              src={coverImg.previewUrl || coverImg.url}
              alt={collection.title}
              className="album-card-cover"
            />
          ) : (
            <div className="album-card-cover-blank" />
          )}
        </div>
        <div className="album-card-info">
          <span className="album-card-title">{collection.title}</span>
          <span className="album-card-meta">{meta}</span>
        </div>
      </button>
    </div>
  )
}
