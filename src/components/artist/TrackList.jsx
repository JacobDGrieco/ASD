import { Link } from 'react-router-dom'
import '../../styles/TrackList.css'

export default function TrackList({ songs }) {
  return (
    <div className="track-list-list">
      {songs.map((song) => (
        <Link key={song.id} to={`/songs/${song.slug}`} className="track-list-row">
          <span className="track-list-num">{song.discNumber > 1 ? `${song.discNumber}-` : ''}{song.trackNumber}</span>
          <span className="track-list-title">{song.title}</span>
          <span className="track-list-duration">{song.duration}</span>
        </Link>
      ))}
    </div>
  )
}
