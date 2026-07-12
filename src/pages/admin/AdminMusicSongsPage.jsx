import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaArrowLeft, FaArrowRight, FaExternalLinkAlt, FaPencilAlt, FaStickyNote, FaTrash } from 'react-icons/fa'
import { SiApplemusic, SiSoundcloud, SiSpotify, SiYoutube } from 'react-icons/si'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx'
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js'
import { isEffectivelyVisible } from '../../lib/contentVisibility.js'
import { isOtherArtist, OTHER_ARTIST_NAME, OTHER_ARTIST_OPTION_ID } from '../../lib/publicVisibility.js'
import AdminSongFormModal from '../../components/admin/AdminSongFormModal.jsx'
import {
  buildSongFormFromDetail,
  hasManualSongVisibilityChoice,
  loadAdminSongDetail,
} from '../../lib/adminSongForm.js'
import '../../styles/AdminArtistsPage.css'
import '../../styles/AdminSongsPage.css'

const PAGE_SIZE = 30
const SONGS_FILTER_STATE_KEY = 'admin-songs-page-state'

function primaryImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null
  return images.find((image) => image.isPrimary) ?? images[0]
}

function isSongHidden(song) {
  const album = song?.album ?? song?.placements?.[0]?.album ?? null
  const releaseDate = song?.meta?.releaseDate ?? album?.releaseDate ?? null
  return (
    (!isOtherArtist(album?.artist) && album?.artist?.isVisible === false) ||
    !isEffectivelyVisible(song, releaseDate)
  )
}

function compareLexicographically(left, right) {
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
}

function withOtherArtistOption(artists) {
  return [...artists, { id: OTHER_ARTIST_OPTION_ID, name: OTHER_ARTIST_NAME }]
}

function placementAlbumIds(song) {
  if (Array.isArray(song.albumIds) && song.albumIds.length) return song.albumIds
  if (Array.isArray(song.placements) && song.placements.length) return song.placements.map((p) => p.albumId)
  return song.albumId ? [song.albumId] : []
}

function primaryAlbum(song, albumById) {
  if (song.album?.id) return song.album
  const albumIds = placementAlbumIds(song)
  return albumIds.length ? albumById[albumIds[0]] ?? null : null
}

function displayArtistName(song, albumById) {
  const album = primaryAlbum(song, albumById)
  if (!album) return null
  if (isOtherArtist(album.artist)) return album.otherArtistName || OTHER_ARTIST_NAME
  return album.artist?.name ?? null
}

function primaryTrackNumber(song) {
  if (song.trackNumber) return song.trackNumber
  if (Array.isArray(song.albumPlacements) && song.albumPlacements.length) return song.albumPlacements[0]?.trackNumber ?? null
  if (Array.isArray(song.placements) && song.placements.length) return song.placements[0]?.trackNumber ?? null
  return null
}

function albumTitles(song, albumById) {
  const titles = placementAlbumIds(song).flatMap((albumId) => {
    const title = albumById[albumId]?.title ?? song.placements?.find((p) => p.albumId === albumId)?.album?.title ?? null
    return title ? [title] : []
  })
  return titles.length ? titles.join(', ') : null
}

function imageCell(song, albumById) {
  const albumIds = placementAlbumIds(song)
  const album = albumIds.length ? albumById[albumIds[0]] ?? null : null

  const albumImage = album ? primaryImage(album.images) : null
  const songImage = primaryImage(song.images)
  const displayImage = albumImage ?? songImage

  if (!displayImage) return <span className="admin-artists-page-empty-value">-</span>

  const albumCount = album ? (album.imageCount ?? album.images?.length ?? 0) : 0
  const songCount = song.imageCount ?? song.images?.length ?? 0
  const count = albumCount + songCount

  return (
    <div className="admin-artists-page-image-summary">
      <div className={`admin-artists-page-thumb-frame ${isSongHidden(song) ? 'admin-artists-page-thumb-frame-hidden' : ''}`.trim()}>
        <img src={displayImage.previewUrl || displayImage.url} alt={song.title} className="admin-artists-page-thumb" />
      </div>
      <span className="admin-artists-page-image-count">
        {count} image{count === 1 ? '' : 's'}
      </span>
    </div>
  )
}

function cell(value) {
  return value ? (
    <span className="admin-artists-page-cell-value" title={String(value)}>{String(value)}</span>
  ) : (
    <span className="admin-artists-page-empty-value">-</span>
  )
}

function wrapCell(value) {
  return value ? (
    <span className="admin-artists-page-wrap-value" title={String(value)}>{String(value)}</span>
  ) : (
    <span className="admin-artists-page-empty-value">-</span>
  )
}

function linkCell(song, key, label) {
  const value = song[key]
  return value ? (
    <a
      href={String(value)}
      target="_blank"
      rel="noreferrer"
      className="admin-artists-page-link-btn"
      aria-label={`Open ${label} link`}
      title="Open in new tab"
    >
      <FaExternalLinkAlt aria-hidden="true" />
    </a>
  ) : (
    <span className="admin-artists-page-empty-value">-</span>
  )
}

function SongsTable({ songs, albumById, isViewer, loadingEditSongId, onEdit, onDelete }) {
  return (
    <div className="admin-artists-page-table-wrap">
      <table className="admin-artists-page-table admin-songs-table">
        <thead>
          <tr>
            <th className="admin-artists-page-col-image">Images</th>
            <th className="admin-songs-col-track admin-artists-page-center-cell">#</th>
            <th className="admin-songs-col-title">Title</th>
            <th className="admin-songs-col-artist">Artist</th>
            <th className="admin-songs-col-featured">Featured</th>
            <th className="admin-songs-col-album">Album</th>
            <th className="admin-songs-col-date">Release Date</th>
            <th className="admin-artists-page-col-action admin-artists-page-center-cell">
              <span className="admin-artists-page-social-header" title="SoundCloud"><SiSoundcloud aria-hidden="true" /><span className="admin-artists-page-sr-only">SoundCloud</span></span>
            </th>
            <th className="admin-artists-page-col-action admin-artists-page-center-cell">
              <span className="admin-artists-page-social-header" title="Spotify"><SiSpotify aria-hidden="true" /><span className="admin-artists-page-sr-only">Spotify</span></span>
            </th>
            <th className="admin-artists-page-col-action admin-artists-page-center-cell">
              <span className="admin-artists-page-social-header" title="Apple Music"><SiApplemusic aria-hidden="true" /><span className="admin-artists-page-sr-only">Apple Music</span></span>
            </th>
            <th className="admin-artists-page-col-action admin-artists-page-center-cell">
              <span className="admin-artists-page-social-header" title="YouTube"><SiYoutube aria-hidden="true" /><span className="admin-artists-page-sr-only">YouTube</span></span>
            </th>
            <th className="admin-songs-col-actions admin-artists-page-sticky-right-0"></th>
          </tr>
        </thead>
        <tbody>
          {songs.map((song) => {
            const releaseDate = song.meta?.releaseDate ?? primaryAlbum(song, albumById)?.releaseDate ?? ''
            const dateStr = releaseDate ? String(releaseDate).slice(0, 10) : ''
            return (
              <tr key={song.id} className={isSongHidden(song) ? 'admin-artists-page-hidden-row' : ''}>
                <td className="admin-artists-page-col-image">{imageCell(song, albumById)}</td>
                <td className="admin-songs-col-track admin-artists-page-center-cell">{cell(primaryTrackNumber(song))}</td>
                <td className="admin-songs-col-title">{cell(song.title)}</td>
                <td className="admin-songs-col-artist">{cell(displayArtistName(song, albumById))}</td>
                <td className="admin-songs-col-featured">{cell(song.meta?.featuredArtists)}</td>
                <td className="admin-songs-col-album">{wrapCell(albumTitles(song, albumById))}</td>
                <td className="admin-songs-col-date">{cell(dateStr)}</td>
                <td className="admin-artists-page-col-action admin-artists-page-center-cell">{linkCell(song, 'soundcloudUrl', 'SoundCloud')}</td>
                <td className="admin-artists-page-col-action admin-artists-page-center-cell">{linkCell(song, 'spotifyUrl', 'Spotify')}</td>
                <td className="admin-artists-page-col-action admin-artists-page-center-cell">{linkCell(song, 'appleMusicUrl', 'Apple Music')}</td>
                <td className="admin-artists-page-col-action admin-artists-page-center-cell">{linkCell(song, 'youtubeUrl', 'YouTube')}</td>
                <td className="admin-songs-col-actions admin-artists-page-sticky-right-0">
                  <div className="admin-songs-actions">
                    <Link
                      to={`/admin/lyrics/${song.id}`}
                      state={{ songTitle: song.title }}
                      className="admin-artists-page-ghost-btn admin-artists-page-icon-btn"
                      style={{ textDecoration: 'none' }}
                      aria-label="Edit lyrics"
                      title="Edit lyrics"
                    >
                      <FaStickyNote aria-hidden="true" />
                    </Link>
                    {!isViewer && (
                      <button type="button" onClick={() => void onEdit(song)} disabled={loadingEditSongId === song.id} className="admin-artists-page-ghost-btn admin-artists-page-icon-btn" aria-label="Edit song" title="Edit">
                        <FaPencilAlt aria-hidden="true" />
                      </button>
                    )}
                    {!isViewer && (
                      <ConfirmActionButton
                        message="Delete this song and all its lyrics/annotations?"
                        onConfirm={() => onDelete(song.id)}
                        buttonClassName="admin-artists-page-danger-btn admin-artists-page-icon-btn"
                        buttonAriaLabel="Delete song"
                        buttonTitle="Delete"
                      >
                        <FaTrash aria-hidden="true" />
                      </ConfirmActionButton>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SongsPagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  return (
    <div className="admin-pagination">
      <button type="button" className="admin-pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
        <><FaArrowLeft aria-hidden="true" /> Prev</>
      </button>
      <span className="admin-pagination-info">Page {currentPage} of {totalPages}</span>
      <button type="button" className="admin-pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
        <>Next <FaArrowRight aria-hidden="true" /></>
      </button>
    </div>
  )
}

export default function AdminMusicSongsPage() {
  const { token, session } = useAdminAuth()
  const isViewer = session?.role === 'VIEWER'
  const auth = { Authorization: `Bearer ${token}` }
  const initialFilterState = (() => {
    if (typeof window === 'undefined') return { filterArtist: '', filterAlbum: '', filterTitle: '', page: 1 }
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(SONGS_FILTER_STATE_KEY) ?? '{}')
      return {
        filterArtist: typeof saved.filterArtist === 'string' ? saved.filterArtist : '',
        filterAlbum: typeof saved.filterAlbum === 'string' ? saved.filterAlbum : '',
        filterTitle: typeof saved.filterTitle === 'string' ? saved.filterTitle : '',
        page: Number.isInteger(saved.page) && saved.page > 0 ? saved.page : 1,
      }
    } catch {
      return { filterArtist: '', filterAlbum: '', filterTitle: '', page: 1 }
    }
  })()

  const [songs, setSongs] = useState([])
  const [albums, setAlbums] = useState([])
  const [artists, setArtists] = useState([])
  const [filterArtist, setFilterArtist] = useState(initialFilterState.filterArtist)
  const [filterAlbum, setFilterAlbum] = useState(initialFilterState.filterAlbum)
  const [filterTitle, setFilterTitle] = useState(initialFilterState.filterTitle)
  const [page, setPage] = useState(initialFilterState.page)
  const [editingSongForm, setEditingSongForm] = useState(null)
  const [editingSongVisibilityTouched, setEditingSongVisibilityTouched] = useState(false)
  const [loadingEditSongId, setLoadingEditSongId] = useState(null)
  const [creatingWithPrefill, setCreatingWithPrefill] = useState(null)
  const deferredFilterTitle = useDeferredValue(filterTitle)
  const isModalOpen = editingSongForm !== null || creatingWithPrefill !== null

  useEffect(() => {
    let ignore = false
    loadAdminResource({ cacheKey: 'songs-list', url: '/api/admin/songs', token }).then((songList) => {
      if (!ignore) setSongs(songList)
    })
    loadAdminResource({ cacheKey: 'albums-list', url: '/api/admin/albums', token }).then((albumList) => {
      if (!ignore) setAlbums(albumList)
    })
    loadAdminResource({ cacheKey: 'artists-list', url: '/api/admin/artists', token }).then((artistList) => {
      if (!ignore) setArtists(artistList)
    })
    return () => { ignore = true }
  }, [token])

  const albumById = useMemo(
    () => Object.fromEntries(albums.map((album) => [album.id, album])),
    [albums]
  )

  const albumOptions = useMemo(() => (
    filterArtist
      ? albums.filter((album) => (
          filterArtist === OTHER_ARTIST_OPTION_ID
            ? isOtherArtist(album.artist)
            : album.artistId === filterArtist
        ))
      : albums
  ), [albums, filterArtist])

  const sortedArtists = useMemo(() => (
    withOtherArtistOption(artists).toSorted((left, right) => compareLexicographically(left.name, right.name))
  ), [artists])

  const sortedAlbumOptions = useMemo(
    () => albumOptions.toSorted((left, right) => compareLexicographically(left.title, right.title)),
    [albumOptions]
  )

  const filteredSongs = useMemo(() => (
    songs.filter((song) => {
      const albumIds = placementAlbumIds(song)
      if (filterAlbum && !albumIds.includes(filterAlbum)) return false
      if (deferredFilterTitle && !song.title.toLowerCase().includes(deferredFilterTitle.trim().toLowerCase())) return false
      if (filterArtist) {
        const hasMatchingArtist = albumIds.some((albumId) => (
          filterArtist === OTHER_ARTIST_OPTION_ID
            ? isOtherArtist(albumById[albumId]?.artist)
            : albumById[albumId]?.artistId === filterArtist
        ))
        if (!hasMatchingArtist) return false
      }
      return true
    })
  ), [albumById, deferredFilterTitle, filterAlbum, filterArtist, songs])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE)), [filteredSongs.length])
  const currentPage = Math.min(page, totalPages)
  const pagedSongs = useMemo(
    () => filteredSongs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, filteredSongs]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(SONGS_FILTER_STATE_KEY, JSON.stringify({ filterArtist, filterAlbum, filterTitle, page: currentPage }))
  }, [currentPage, filterAlbum, filterArtist, filterTitle])

  const openCreate = () => {
    setCreatingWithPrefill({
      albumId: filterAlbum,
      releaseDate: filterAlbum ? albumById[filterAlbum]?.releaseDate?.slice?.(0, 10) ?? '' : '',
    })
  }

  const openEdit = async (song) => {
    setLoadingEditSongId(song.id)
    try {
      const detail = await loadAdminSongDetail(song.id, token)
      setCreatingWithPrefill(null)
      setEditingSongVisibilityTouched(hasManualSongVisibilityChoice(detail))
      setEditingSongForm(buildSongFormFromDetail(detail))
    } catch (error) {
      console.error(error)
      window.alert(error instanceof Error ? error.message : 'Failed to load song.')
    } finally {
      setLoadingEditSongId(null)
    }
  }

  const closeModal = () => {
    setEditingSongForm(null)
    setEditingSongVisibilityTouched(false)
    setCreatingWithPrefill(null)
  }

  const handleSongSaved = (saved) => {
    const nextSongs = editingSongForm?.id
      ? songs.map((s) => (s.id === saved.id ? saved : s))
      : [...songs, saved]
    setSongs(nextSongs)
    primeAdminResource('songs-list', token, nextSongs)
    closeModal()
  }

  const handleDelete = async (id) => {
    await fetch(`/api/admin/songs?id=${id}`, { method: 'DELETE', headers: auth })
    const nextSongs = songs.filter((song) => song.id !== id)
    setSongs(nextSongs)
    primeAdminResource('songs-list', token, nextSongs)
  }

  const isArtistScoped = session?.role === 'ARTIST'

  return (
    <div>
      <div className="admin-artists-page-sticky-top">
        <div className="admin-artists-page-header">
          <h1 className="admin-artists-page-title">Music â€” Songs</h1>
          {!isViewer && (
            <button type="button" onClick={openCreate} className="admin-artists-page-primary-btn">New Song</button>
          )}
        </div>

        <div className="admin-filter-bar">
          <input
            type="search"
            value={filterTitle}
            onChange={(e) => {
              setFilterTitle(e.target.value)
              setPage(1)
            }}
            className="admin-filter-select"
            placeholder="Search title..."
            aria-label="Search songs by title"
          />
          {!isArtistScoped && (
            <select
              value={filterArtist}
              onChange={(e) => {
                setFilterArtist(e.target.value)
                setFilterAlbum('')
                setPage(1)
              }}
              className="admin-filter-select"
              aria-label="Filter songs by artist"
            >
              <option value="">All Artists</option>
              {sortedArtists.map((artist) => (
                <option key={artist.id} value={artist.id}>{artist.name}</option>
              ))}
            </select>
          )}
          <select
            value={filterAlbum}
            onChange={(e) => {
              setFilterAlbum(e.target.value)
              setPage(1)
            }}
            className="admin-filter-select"
            aria-label="Filter songs by album"
          >
            <option value="">All Albums</option>
            {sortedAlbumOptions.map((album) => (
              <option key={album.id} value={album.id}>{album.title}</option>
            ))}
          </select>
        </div>
      </div>

      {!isModalOpen && (
        <SongsTable
          songs={pagedSongs}
          albumById={albumById}
          isViewer={isViewer}
          loadingEditSongId={loadingEditSongId}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {!isModalOpen && (
        <SongsPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
      )}

      {isModalOpen && (
        <AdminSongFormModal
          initialForm={editingSongForm}
          initialVisibilityTouched={editingSongVisibilityTouched}
          prefill={creatingWithPrefill}
          songs={songs}
          albums={albums}
          token={token}
          session={session}
          onSaved={handleSongSaved}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
