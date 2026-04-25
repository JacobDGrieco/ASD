import { Link } from 'react-router-dom'
import { FaApple, FaSoundcloud, FaSpotify } from 'react-icons/fa'
import { prefetchArtistPage } from '../../lib/publicPrefetch.js'
import SoundCloudPlayer from '../shared/SoundCloudPlayer.jsx'
import '../../styles/SongHeader.css'

export default function SongHeader({ song }) {
  const artistLinkData = song.album?.artist
    ? { slug: song.album.artist.slug, images: [], portrait: song.album.coverArt }
    : null
  const streamLinks = [
    { href: song.soundcloudUrl, label: 'SoundCloud', icon: FaSoundcloud },
    { href: song.spotifyUrl, label: 'Spotify', icon: FaSpotify },
    { href: song.appleMusicUrl, label: 'Apple Music', icon: FaApple },
  ].filter((link) => link.href)

  return (
    <section className="song-header-header">
      <div className="song-header-media-column">
        <div className="song-header-art-wrap">
          {song.album.coverArt
            ? <img src={song.album.coverArt} alt={song.album.title} className="song-header-art" />
            : <div className="song-header-art-blank" />
          }
        </div>
        {streamLinks.length > 0 && (
          <div className="song-header-stream-links">
            {streamLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="song-header-stream-link"
                aria-label={link.label}
              >
                <link.icon aria-hidden="true" />
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="song-header-info">
        <div className="song-header-artist-links">
          <Link
            to={`/artists/${song.album.artist.slug}`}
            className="song-header-artist-link"
            onMouseEnter={() => prefetchArtistPage(artistLinkData)}
            onFocus={() => prefetchArtistPage(artistLinkData)}
            onTouchStart={() => prefetchArtistPage(artistLinkData)}
          >
            {song.album.artist.name}
          </Link>
          {song.meta?.featuredArtistLinks?.length > 0 && (
            <span className="song-header-featured-artists">
              {'feat. '}
              {song.meta.featuredArtistLinks.map((artist, i) => (
                <span key={artist.name}>
                  {i > 0 && ', '}
                  {artist.slug
                    ? <Link to={`/artists/${artist.slug}`} className="song-header-featured-link">{artist.name}</Link>
                    : artist.name
                  }
                </span>
              ))}
            </span>
          )}
        </div>
        <h1 className="song-header-title">{song.title}</h1>
        <p className="song-header-meta">
          <Link to={`/${song.album.artist.slug}/${song.album.slug}`}>
            {song.album.title}
          </Link>
          {song.meta?.releaseDate && ` · ${new Date(song.meta.releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}`}
          {song.duration && ` · ${song.duration}`}
        </p>
        {song.soundcloudUrl && (
          <div className="song-header-player">
            <SoundCloudPlayer url={song.soundcloudUrl} autoPlay={false} />
          </div>
        )}
      </div>
    </section>
  )
}
