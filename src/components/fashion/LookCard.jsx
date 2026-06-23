import { Link } from 'react-router-dom'
import '../../styles/AlbumCard.css'

export default function LookCard({ look }) {
  const image = look.images?.[0]

  return (
    <Link to={`/fashion/looks/${look.slug}`} className="album-card-card">
      <div className="album-card-primary-action">
        <div className="album-card-cover-wrap">
          {image ? (
            <img src={image.previewUrl || image.url} alt={look.title} className="album-card-cover" />
          ) : (
            <div className="album-card-cover-blank" />
          )}
        </div>
        <div className="album-card-info">
          <span className="album-card-title">{look.title}</span>
          <span className="album-card-meta">{look.pieces?.length ?? 0} piece{(look.pieces?.length ?? 0) === 1 ? '' : 's'}</span>
        </div>
      </div>
    </Link>
  )
}
