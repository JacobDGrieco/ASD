import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { track } from '@vercel/analytics'
import { FaApple, FaSoundcloud, FaSpotify, FaYoutube } from 'react-icons/fa'
import { prefetchArtistPage } from '../../lib/publicPrefetch.js'
import { buildAlbumPath, isOtherArtist } from '../../lib/publicVisibility.js'
import AppleMusicPlayer from '../shared/AppleMusicPlayer.jsx'
import SoundCloudPlayer from '../shared/SoundCloudPlayer.jsx'
import SpotifyPlayer from '../shared/SpotifyPlayer.jsx'
import ArtworkGallery from '../shared/ArtworkGallery.jsx'
import SongPersonCard from './SongPersonCard.jsx'
import '../../styles/SongHeader.css'

function legacyImage(url, altText, id) {
  return url ? { id, url, previewUrl: url, altText } : null
}

function addUniqueImage(images, image, seen) {
  if (!image?.previewUrl && !image?.url) return

  const keys = [image.pathname, image.previewUrl, image.url].filter(Boolean)
  if (keys.some((key) => seen.has(key))) return

  keys.forEach((key) => seen.add(key))
  images.push(image)
}

function albumGalleryImages(album) {
  if (!album) return []
  return [
    ...(Array.isArray(album.images) ? album.images : []),
    legacyImage(album.coverArt, album.title, `${album.id ?? album.title}-cover`),
  ]
}

function songGalleryImages(song) {
  const images = []
  const seen = new Set()
  const placementAlbums = Array.isArray(song.placements)
    ? song.placements.map((placement) => placement.album)
    : []

  for (const image of [
    ...(Array.isArray(song.images) ? song.images : []),
    legacyImage(song.artwork, song.title, `${song.id}-artwork`),
    ...albumGalleryImages(song.album),
    ...placementAlbums.flatMap(albumGalleryImages),
  ]) {
    addUniqueImage(images, image, seen)
  }

  return images
}

export default function SongHeader({ song, adminPreview = false }) {
  const hasTrackedPlay = useRef(false)
  const galleryImages = useMemo(() => songGalleryImages(song), [song])
  const hasSongArtwork = Array.isArray(song.images) && song.images.length > 0
  const artwork = hasSongArtwork
    ? song.images[0]?.previewUrl || song.images[0]?.url || song.artwork || song.album.coverArt
    : song.album.coverArt
  const artistLinkData = song.album?.artist
    ? { slug: song.album.artist.slug, images: [], portrait: song.album.coverArt }
    : null
  const showArtistPageLink = song.album?.artist && !isOtherArtist(song.album.artist)
  const albumMetaAlbum = Array.isArray(song.placements)
    ? song.placements.find((placement) => placement.album?.type && placement.album.type !== 'SINGLE')?.album ?? song.album
    : song.album
  const albumPagePath = buildAlbumPath({
    album: albumMetaAlbum,
    allowHidden: adminPreview,
  })
  const showAlbumMeta = albumMetaAlbum?.type !== 'SINGLE'
  const releaseDate = song.meta?.releaseDate
    ? new Date(song.meta.releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    : null
  const featuredArtists = song.meta?.featuredArtistLinks?.length
    ? song.meta.featuredArtistLinks
    : song.meta?.roleGroups?.['Featured Artist'] ?? []
  const streamLinks = [
    { href: song.soundcloudUrl, label: 'SoundCloud', icon: FaSoundcloud },
    { href: song.spotifyUrl, label: 'Spotify', icon: FaSpotify },
    { href: song.appleMusicUrl, label: 'Apple Music', icon: FaApple },
    { href: song.youtubeUrl, label: 'YouTube', icon: FaYoutube },
  ].filter((link) => link.href)
  const playerUrl = song.soundcloudUrl || song.spotifyUrl || song.appleMusicUrl || null
  const handleFirstPlay = useCallback(() => {
    if (hasTrackedPlay.current) return

    hasTrackedPlay.current = true
    track('song_played', {
      song: song.title,
      artist: song.album.artist.name,
      player: song.soundcloudUrl ? 'soundcloud'
        : song.spotifyUrl ? 'spotify'
          : 'applemusic',
    })
  }, [song])

  useEffect(() => {
    hasTrackedPlay.current = false
  }, [song.id])

  return (
    <section className={`song-header-header ${song.isPubliclyVisible === false ? 'song-header-hidden' : ''}`.trim()}>
      <div className="song-header-media-column">
        <div className="song-header-art-wrap">
          <ArtworkGallery images={galleryImages} title={song.title} buttonLabel={`View ${song.title} images`} />
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
          <span
            onMouseEnter={() => showArtistPageLink && prefetchArtistPage(artistLinkData)}
            onFocus={() => showArtistPageLink && prefetchArtistPage(artistLinkData)}
            onTouchStart={() => showArtistPageLink && prefetchArtistPage(artistLinkData)}
          >
            <SongPersonCard person={showArtistPageLink ? song.album.artist : { name: song.album.artist.name, image: song.album.artist.image }} label="Artist" />
          </span>
          {featuredArtists.map((artist) => (
            <SongPersonCard key={artist.slug || artist.externalUrl || artist.name} person={artist} label="Featured Artist" />
          ))}
        </div>
        <h1 className="song-header-title">{song.title}</h1>
        {showAlbumMeta ? (
          <p className="song-header-meta">
            {albumPagePath ? <Link to={albumPagePath}>{albumMetaAlbum.title}</Link> : albumMetaAlbum.title}
            {song.meta?.releaseDate && ` · ${new Date(song.meta.releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}`}
          </p>
        ) : releaseDate ? (
          <p className="song-header-meta">
            {releaseDate}
          </p>
        ) : null}
        {playerUrl && (
          <div className="song-header-player">
            {song.soundcloudUrl
              ? <SoundCloudPlayer url={song.soundcloudUrl} autoPlay={false} onPlaybackStart={handleFirstPlay} />
              : song.spotifyUrl
                ? <SpotifyPlayer url={song.spotifyUrl} onPlay={handleFirstPlay} />
                : <AppleMusicPlayer url={song.appleMusicUrl} onPlay={handleFirstPlay} />
            }
          </div>
        )}
      </div>
    </section>
  )
}
