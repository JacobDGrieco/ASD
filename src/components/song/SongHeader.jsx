import { Link } from 'react-router-dom'
import { FaApple, FaSoundcloud, FaSpotify, FaYoutube } from 'react-icons/fa'
import { prefetchArtistPage } from '../../lib/publicPrefetch.js'
import { buildAlbumPath, isOtherArtist } from '../../lib/publicVisibility.js'
import AppleMusicPlayer from '../shared/AppleMusicPlayer.jsx'
import SoundCloudPlayer from '../shared/SoundCloudPlayer.jsx'
import SpotifyPlayer from '../shared/SpotifyPlayer.jsx'
import ArtworkGallery from '../shared/ArtworkGallery.jsx'
import '../../styles/SongHeader.css'

export default function SongHeader({ song, adminPreview = false }) {
  const hasSongArtwork = Array.isArray(song.images) && song.images.length > 0
  const artwork = hasSongArtwork
    ? song.images[0]?.previewUrl || song.images[0]?.url || song.artwork || song.album.coverArt
    : song.album.coverArt
  const artistLinkData = song.album?.artist
    ? { slug: song.album.artist.slug, images: [], portrait: song.album.coverArt }
    : null
  const showArtistPageLink = song.album?.artist && !isOtherArtist(song.album.artist)
  const albumPagePath = buildAlbumPath({
    album: song.album,
    allowHidden: adminPreview,
  })
  const streamLinks = [
    { href: song.soundcloudUrl, label: 'SoundCloud', icon: FaSoundcloud },
    { href: song.spotifyUrl, label: 'Spotify', icon: FaSpotify },
    { href: song.appleMusicUrl, label: 'Apple Music', icon: FaApple },
    { href: song.youtubeUrl, label: 'YouTube', icon: FaYoutube },
  ].filter((link) => link.href)
  const playerUrl = song.soundcloudUrl || song.spotifyUrl || song.appleMusicUrl || null

  return (
    <section className={`song-header-header ${song.isPubliclyVisible === false ? 'song-header-hidden' : ''}`.trim()}>
      <div className="song-header-media-column">
        <div className="song-header-art-wrap">
          {hasSongArtwork && <ArtworkGallery images={song.images} title={song.title} />}
          {artwork
            ? <img src={artwork} alt={song.title} className="song-header-art" />
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
        {song.isPubliclyVisible === false && <span className="song-header-visibility-badge">Hidden in public view</span>}
        <div className="song-header-artist-links">
          {showArtistPageLink ? (
            <Link
              to={`/artists/${song.album.artist.slug}`}
              className="song-header-artist-link"
              onMouseEnter={() => prefetchArtistPage(artistLinkData)}
              onFocus={() => prefetchArtistPage(artistLinkData)}
              onTouchStart={() => prefetchArtistPage(artistLinkData)}
            >
              {song.album.artist.name}
            </Link>
          ) : (
            <span className="song-header-artist-link">{song.album.artist.name}</span>
          )}
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
          {albumPagePath ? <Link to={albumPagePath}>{song.album.title}</Link> : song.album.title}
          {song.meta?.releaseDate && ` · ${new Date(song.meta.releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}`}
          {song.duration && ` · ${song.duration}`}
        </p>
        {playerUrl && (
          <div className="song-header-player">
            {song.soundcloudUrl
              ? <SoundCloudPlayer url={song.soundcloudUrl} autoPlay={false} />
              : song.spotifyUrl
                ? <SpotifyPlayer url={song.spotifyUrl} />
                : <AppleMusicPlayer url={song.appleMusicUrl} />
            }
          </div>
        )}
      </div>
    </section>
  )
}
