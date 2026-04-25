import { Link } from 'react-router-dom'
import { prefetchSongPage } from '../../lib/publicPrefetch.js'
import '../../styles/TrackList.css'

export default function TrackList({ songs, artistSlug, albumSlug }) {
  return (
    <div className="track-list-list">
      {songs.map((song) => (
        <Link
          key={song.id}
          to={`/${artistSlug}/${albumSlug}/${song.slug}`}
          className="track-list-row"
          onMouseEnter={() => prefetchSongPage(song.slug)}
          onFocus={() => prefetchSongPage(song.slug)}
          onTouchStart={() => prefetchSongPage(song.slug)}
        >
          <span className="track-list-num">{song.discNumber > 1 ? `${song.discNumber}-` : ''}{song.trackNumber}</span>
          <span className="track-list-title">{song.title}</span>
          <span className="track-list-duration">{song.duration}</span>
        </Link>
      ))}
    </div>
  )
}
