import { Link } from 'react-router-dom'
import '../../styles/AlbumCard.css'

export default function CollectionCard({ collection, isOpen, onClick, to, metaOverride }) {
  const coverImg = collection.coverImage
  const isLoose = collection.collectionType === 'LOOSE_LOOK' || collection.catalogueType === 'loose'
  const lookCount = collection.looks?.length ?? 0
  const meta = metaOverride ?? [
    isLoose ? 'Loose' : 'Collection',
    collection.season,
    isLoose ? null : `${lookCount} look${lookCount === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' - ')

  const content = (
    <>
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
    </>
  )

  if (to) {
    return (
      <Link to={to} className={`album-card-card${isOpen ? ' album-card-open' : ''}`}>
        <div className="album-card-primary-action">
          {content}
        </div>
      </Link>
    )
  }

  return (
    <div className={`album-card-card${isOpen ? ' album-card-open' : ''}`}>
      <button type="button" className="album-card-primary-action" onClick={onClick}>
        {content}
      </button>
    </div>
  )
}
