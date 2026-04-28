import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { TabPanel, TabView } from 'primereact/tabview'
import { FaArrowLeft, FaArrowRight, FaExternalLinkAlt, FaPencilAlt, FaStickyNote, FaTimes, FaTrash } from 'react-icons/fa'
import { SiApplemusic, SiSoundcloud, SiSpotify, SiYoutube } from 'react-icons/si'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx'
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js'
import { isOtherArtist, OTHER_ARTIST_NAME, OTHER_ARTIST_OPTION_ID } from '../../lib/publicVisibility.js'
import { slugify } from '../../lib/slugify.js'
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx'
import ChipInputField from '../../components/admin/ChipInputField.jsx'
import '../../styles/AdminArtistsPage.css'
import '../../styles/AdminSongsPage.css'

const PAGE_SIZE = 30
const SONGS_FILTER_STATE_KEY = 'admin-songs-page-state'

function createAlbumPlacement() {
  return {
    albumId: '',
    trackNumber: 1,
    discNumber: 1,
  }
}

const empty = {
  title: '',
  slug: '',
  duration: '',
  soundcloudUrl: '',
  spotifyUrl: '',
  appleMusicUrl: '',
  youtubeUrl: '',
  aboutText: '',
  producers: '',
  writers: '',
  featuredArtists: '',
  releaseDate: '',
  images: [],
  tags: [],
  albumPlacements: [createAlbumPlacement()],
}

function primaryImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null
  return images.find((image) => image.isPrimary) ?? images[0]
}

function compareLexicographically(left, right) {
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
}

function withOtherArtistOption(artists) {
  return [...artists, { id: OTHER_ARTIST_OPTION_ID, name: OTHER_ARTIST_NAME }]
}

function placementAlbumIds(song) {
  if (Array.isArray(song.albumIds) && song.albumIds.length) return song.albumIds
  if (Array.isArray(song.placements) && song.placements.length) return song.placements.map((placement) => placement.albumId)
  return song.albumId ? [song.albumId] : []
}

function buildPlacementForm(song) {
  if (Array.isArray(song.albumPlacements) && song.albumPlacements.length) {
    return song.albumPlacements.map((placement) => ({
      albumId: placement.albumId ?? '',
      trackNumber: Number(placement.trackNumber ?? 1),
      discNumber: Number(placement.discNumber ?? 1),
    }))
  }

  if (Array.isArray(song.placements) && song.placements.length) {
    return song.placements.map((placement) => ({
      albumId: placement.albumId ?? placement.album?.id ?? '',
      trackNumber: Number(placement.trackNumber ?? 1),
      discNumber: Number(placement.discNumber ?? 1),
    }))
  }

  if (song.albumId) {
    return [
      {
        albumId: song.albumId,
        trackNumber: Number(song.trackNumber ?? 1),
        discNumber: Number(song.discNumber ?? 1),
      },
    ]
  }

  return [createAlbumPlacement()]
}

function validateSongForm(form) {
  if (!form.title?.trim()) return 'Song title is required.'
  if (!Array.isArray(form.albumPlacements) || form.albumPlacements.length === 0) return 'At least one album is required.'

  const seenAlbumIds = new Set()
  for (const placement of form.albumPlacements) {
    if (!placement.albumId) return 'Each album card must have an album selected.'
    if (seenAlbumIds.has(placement.albumId)) return 'Each album can only be selected once per song.'
    if (!placement.trackNumber || Number(placement.trackNumber) < 1) return 'Track number must be at least 1 for each album card.'
    if (!placement.discNumber || Number(placement.discNumber) < 1) return 'Disc number must be at least 1 for each album card.'
    seenAlbumIds.add(placement.albumId)
  }

  return null
}

export default function AdminSongsPage() {
  const { token, session } = useAdminAuth()
  const isArtistScoped = session?.role === 'ARTIST'
  const auth = { Authorization: `Bearer ${token}` }
  const initialFilterState = (() => {
    if (typeof window === 'undefined') {
      return { filterArtist: '', filterAlbum: '', page: 1 }
    }

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
  const [form, setForm] = useState(null)
  const [filterArtist, setFilterArtist] = useState(initialFilterState.filterArtist)
  const [filterAlbum, setFilterAlbum] = useState(initialFilterState.filterAlbum)
  const [filterTitle, setFilterTitle] = useState(initialFilterState.filterTitle)
  const [page, setPage] = useState(initialFilterState.page)
  const [loadingEditId, setLoadingEditId] = useState(null)
  const deferredFilterTitle = useDeferredValue(filterTitle)
  const hasHydratedArtistFilter = useRef(false)
  const hasHydratedAlbumFilter = useRef(false)

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

    return () => {
      ignore = true
    }
  }, [token])

  useEffect(() => {
    if (!hasHydratedArtistFilter.current) {
      hasHydratedArtistFilter.current = true
      return
    }
    setPage(1)
    setFilterAlbum('')
  }, [filterArtist])

  useEffect(() => {
    if (!hasHydratedAlbumFilter.current) {
      hasHydratedAlbumFilter.current = true
      return
    }
    setPage(1)
  }, [filterAlbum])

  useEffect(() => {
    setPage(1)
  }, [filterTitle])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(SONGS_FILTER_STATE_KEY, JSON.stringify({
      filterArtist,
      filterAlbum,
      filterTitle,
      page,
    }))
  }, [filterArtist, filterAlbum, filterTitle, page])

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
    withOtherArtistOption(artists).sort((left, right) =>
      compareLexicographically(left.name, right.name)
    )
  ), [artists])
  const sortedAlbumOptions = useMemo(
    () => [...albumOptions].sort((left, right) => compareLexicographically(left.title, right.title)),
    [albumOptions]
  )
  const sortedAlbums = useMemo(
    () => [...albumOptions].sort((left, right) => compareLexicographically(left.title, right.title)),
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
    if (page !== currentPage) setPage(currentPage)
  }, [page, currentPage])

  const openCreate = () => setForm({ ...empty, albumPlacements: [createAlbumPlacement()] })
  const openEdit = async (song) => {
    setLoadingEditId(song.id)
    try {
      const detail = await fetch(`/api/admin/songs?id=${song.id}`, { headers: auth }).then((response) => response.json())
      setForm({
        ...empty,
        ...detail,
        images: detail.images ?? [],
        aboutText: detail.meta?.aboutText ?? '',
        producers: detail.meta?.producers ?? '',
        writers: detail.meta?.writers ?? '',
        featuredArtists: detail.meta?.featuredArtists ?? '',
        tags: detail.meta?.tags ?? [],
        releaseDate: detail.meta?.releaseDate ? detail.meta.releaseDate.slice(0, 10) : '',
        albumPlacements: buildPlacementForm(detail),
      })
    } finally {
      setLoadingEditId(null)
    }
  }
  const closeForm = () => setForm(null)

  const handleSave = async () => {
    const validationError = validateSongForm(form)
    if (validationError) {
      window.alert(validationError)
      return
    }

    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/admin/songs?id=${form.id}` : '/api/admin/songs'
    const payload = {
      ...form,
      slug: slugify(form.title),
      albumIds: form.albumPlacements.map((placement) => placement.albumId),
      discNumbers: form.albumPlacements.map((placement) => Number(placement.discNumber)),
      trackNumbers: form.albumPlacements.map((placement) => Number(placement.trackNumber)),
    }

    const response = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to save song.' }))
      window.alert(error.error ?? 'Failed to save song.')
      return
    }

    const saved = await response.json()
    const nextSongs = isEdit ? songs.map((song) => (song.id === saved.id ? saved : song)) : [...songs, saved]
    setSongs(nextSongs)
    primeAdminResource('songs-list', token, nextSongs)
    closeForm()
  }

  const handleDelete = async (id) => {
    await fetch(`/api/admin/songs?id=${id}`, { method: 'DELETE', headers: auth })
    const nextSongs = songs.filter((song) => song.id !== id)
    setSongs(nextSongs)
    primeAdminResource('songs-list', token, nextSongs)
  }

  const set = (key) => (event) =>
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
      ...(key === 'title' ? { slug: slugify(event.target.value) } : {}),
    }))

  const setAlbumPlacement = (index, key) => (event) =>
    setForm((current) => ({
      ...current,
      albumPlacements: current.albumPlacements.map((placement, placementIndex) =>
        placementIndex === index
          ? {
              ...placement,
              [key]: key === 'albumId' ? event.target.value : Number(event.target.value),
            }
          : placement
      ),
    }))

  const addAlbumPlacement = () =>
    setForm((current) => ({
      ...current,
      albumPlacements: [...current.albumPlacements, createAlbumPlacement()],
    }))

  const removeAlbumPlacement = (index) =>
    setForm((current) => ({
      ...current,
      albumPlacements: current.albumPlacements.filter((_, placementIndex) => placementIndex !== index),
    }))

  const cell = (value) =>
    value ? (
      <span className="admin-artists-page-cell-value" title={String(value)}>
        {String(value)}
      </span>
    ) : (
      <span className="admin-artists-page-empty-value">-</span>
    )

  const wrapCell = (value) =>
    value ? (
      <span className="admin-artists-page-wrap-value" title={String(value)}>
        {String(value)}
      </span>
    ) : (
      <span className="admin-artists-page-empty-value">-</span>
    )

  const linkCell = (song, key, label) => {
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

  const primaryAlbum = (song) => {
    if (song.album?.id) return song.album
    const albumIds = placementAlbumIds(song)
    return albumIds.length ? albumById[albumIds[0]] ?? null : null
  }

  const displayArtistName = (song) => {
    const album = primaryAlbum(song)
    if (!album) return null
    if (isOtherArtist(album.artist)) return album.otherArtistName || OTHER_ARTIST_NAME
    return album.artist?.name ?? null
  }

  const primaryTrackNumber = (song) => {
    if (song.trackNumber) return song.trackNumber
    if (Array.isArray(song.albumPlacements) && song.albumPlacements.length) {
      return song.albumPlacements[0]?.trackNumber ?? null
    }
    if (Array.isArray(song.placements) && song.placements.length) {
      return song.placements[0]?.trackNumber ?? null
    }
    return null
  }

  const albumTitles = (song) => {
    const titles = placementAlbumIds(song)
      .map((albumId) => albumById[albumId]?.title ?? song.placements?.find((placement) => placement.albumId === albumId)?.album?.title ?? null)
      .filter(Boolean)
    return titles.length ? titles.join(', ') : null
  }

  const imageCell = (song) => {
    const image = primaryImage(song.images)
    if (!image) return <span className="admin-artists-page-empty-value">-</span>

    return (
      <div className="admin-artists-page-image-summary">
        <img src={image.previewUrl || image.url} alt={song.title} className="admin-artists-page-thumb" />
        <span className="admin-artists-page-image-count">
          {song.imageCount ?? song.images?.length ?? 1} image{(song.imageCount ?? song.images?.length ?? 1) === 1 ? '' : 's'}
        </span>
      </div>
    )
  }

  return (
    <div>
      <div className="admin-artists-page-header">
        <h1 className="admin-artists-page-title">Songs</h1>
        <button onClick={openCreate} className="admin-artists-page-primary-btn">
          New Song
        </button>
      </div>

      <div className="admin-filter-bar">
        <input
          type="search"
          value={filterTitle}
          onChange={(event) => setFilterTitle(event.target.value)}
          className="admin-filter-select"
          placeholder="Search title..."
        />
        {!isArtistScoped && (
          <select value={filterArtist} onChange={(event) => setFilterArtist(event.target.value)} className="admin-filter-select">
            <option value="">All Artists</option>
            {sortedArtists.map((artist) => (
              <option key={artist.id} value={artist.id}>
                {artist.name}
              </option>
            ))}
          </select>
        )}
        <select value={filterAlbum} onChange={(event) => setFilterAlbum(event.target.value)} className="admin-filter-select">
          <option value="">All Albums</option>
          {sortedAlbumOptions.map((album) => (
            <option key={album.id} value={album.id}>
              {album.title}
            </option>
          ))}
        </select>
      </div>

      {!form && (
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
                <span className="admin-artists-page-social-header" title="SoundCloud">
                  <SiSoundcloud aria-hidden="true" />
                  <span className="admin-artists-page-sr-only">SoundCloud</span>
                </span>
              </th>
              <th className="admin-artists-page-col-action admin-artists-page-center-cell">
                <span className="admin-artists-page-social-header" title="Spotify">
                  <SiSpotify aria-hidden="true" />
                  <span className="admin-artists-page-sr-only">Spotify</span>
                </span>
              </th>
              <th className="admin-artists-page-col-action admin-artists-page-center-cell">
                <span className="admin-artists-page-social-header" title="Apple Music">
                  <SiApplemusic aria-hidden="true" />
                  <span className="admin-artists-page-sr-only">Apple Music</span>
                </span>
              </th>
              <th className="admin-artists-page-col-action admin-artists-page-center-cell">
                <span className="admin-artists-page-social-header" title="YouTube">
                  <SiYoutube aria-hidden="true" />
                  <span className="admin-artists-page-sr-only">YouTube</span>
                </span>
              </th>
              <th className="admin-songs-col-actions admin-artists-page-sticky-right-0"></th>
            </tr>
          </thead>
          <tbody>
            {pagedSongs.map((song) => {
              const releaseDate = song.meta?.releaseDate ?? primaryAlbum(song)?.releaseDate ?? ''
              const dateStr = releaseDate ? String(releaseDate).slice(0, 10) : ''

              return (
                <tr key={song.id}>
                  <td className="admin-artists-page-col-image">{imageCell(song)}</td>
                  <td className="admin-songs-col-track admin-artists-page-center-cell">{cell(primaryTrackNumber(song))}</td>
                  <td className="admin-songs-col-title">{cell(song.title)}</td>
                  <td className="admin-songs-col-artist">{cell(displayArtistName(song))}</td>
                  <td className="admin-songs-col-featured">{cell(song.meta?.featuredArtists)}</td>
                  <td className="admin-songs-col-album">{wrapCell(albumTitles(song))}</td>
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
                      <button type="button" onClick={() => void openEdit(song)} disabled={loadingEditId === song.id} className="admin-artists-page-ghost-btn admin-artists-page-icon-btn" aria-label="Edit song" title="Edit">
                        <FaPencilAlt aria-hidden="true" />
                      </button>
                      <ConfirmActionButton
                        message="Delete this song and all its lyrics/annotations?"
                        onConfirm={() => handleDelete(song.id)}
                        buttonClassName="admin-artists-page-danger-btn admin-artists-page-icon-btn"
                        buttonAriaLabel="Delete song"
                        buttonTitle="Delete"
                      >
                        <FaTrash aria-hidden="true" />
                      </ConfirmActionButton>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      {!form && totalPages > 1 && (
        <div className="admin-pagination">
          <button type="button" className="admin-pagination-btn" onClick={() => setPage((current) => current - 1)} disabled={currentPage === 1}>
            <><FaArrowLeft aria-hidden="true" /> Prev</>
          </button>
          <span className="admin-pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          <button type="button" className="admin-pagination-btn" onClick={() => setPage((current) => current + 1)} disabled={currentPage === totalPages}>
            <>Next <FaArrowRight aria-hidden="true" /></>
          </button>
        </div>
      )}

      {form && (
        <div className="admin-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{form.id ? 'Edit Song' : 'New Song'}</h2>
              <button type="button" onClick={closeForm} className="admin-modal-close" aria-label="Close">
                <FaTimes aria-hidden="true" />
              </button>
            </div>
            <div className="admin-modal-body">
              <TabView className="page-tabview admin-song-editor-tabs">
                <TabPanel header="Song Info">
                  <div className="admin-modal-grid">
                    <div className="admin-modal-field admin-modal-field-full">
                      <label className="admin-modal-label">Title</label>
                      <input type="text" placeholder="Title" value={form.title} onChange={set('title')} className="admin-artists-page-input" />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label className="admin-modal-label">Images</label>
                      <ImageCollectionField
                        value={form.images}
                        onChange={(images) => setForm((current) => ({ ...current, images }))}
                        token={token}
                        folder="songs"
                        entityLabel={form.title || 'Song image'}
                      />
                    </div>
                    <div className="admin-modal-field">
                      <label className="admin-modal-label">Duration</label>
                      <input type="text" placeholder="e.g. 3:42" value={form.duration} onChange={set('duration')} className="admin-artists-page-input" />
                    </div>
                    <div className="admin-modal-field">
                      <label className="admin-modal-label">Release Date</label>
                      <input type="date" value={form.releaseDate} onChange={set('releaseDate')} className="admin-artists-page-input" />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label className="admin-modal-label">Featured Artists</label>
                      <input type="text" placeholder="Featured artists" value={form.featuredArtists} onChange={set('featuredArtists')} className="admin-artists-page-input" />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label className="admin-modal-label">Producers</label>
                      <input type="text" placeholder="Producers" value={form.producers} onChange={set('producers')} className="admin-artists-page-input" />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label className="admin-modal-label">Writers</label>
                      <input type="text" placeholder="Writers" value={form.writers} onChange={set('writers')} className="admin-artists-page-input" />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label className="admin-modal-label">About</label>
                      <textarea placeholder="About this song..." value={form.aboutText} onChange={set('aboutText')} className="admin-artists-page-input admin-modal-textarea" rows={5} />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label className="admin-modal-label">Tags</label>
                      <ChipInputField
                        value={form.tags}
                        onChange={(tags) => setForm((current) => ({ ...current, tags }))}
                        placeholder="Type a tag and press Enter"
                      />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label className="admin-modal-label">SoundCloud URL</label>
                      <input type="text" placeholder="SoundCloud URL" value={form.soundcloudUrl} onChange={set('soundcloudUrl')} className="admin-artists-page-input" />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label className="admin-modal-label">Spotify URL</label>
                      <input type="text" placeholder="Spotify URL" value={form.spotifyUrl} onChange={set('spotifyUrl')} className="admin-artists-page-input" />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label className="admin-modal-label">Apple Music URL</label>
                      <input type="text" placeholder="Apple Music URL" value={form.appleMusicUrl} onChange={set('appleMusicUrl')} className="admin-artists-page-input" />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label className="admin-modal-label">YouTube URL</label>
                      <input type="text" placeholder="YouTube URL" value={form.youtubeUrl} onChange={set('youtubeUrl')} className="admin-artists-page-input" />
                    </div>
                  </div>
                </TabPanel>
                <TabPanel header="Album Info">
                  <div className="admin-song-album-cards">
                    {form.albumPlacements.map((placement, index) => (
                      <div key={`${index}-${placement.albumId || 'new'}`} className="admin-song-album-card">
                        <div className="admin-song-album-card-header">
                          <h3 className="admin-song-album-card-title">Album {index + 1}</h3>
                          {form.albumPlacements.length > 1 && (
                            <button type="button" onClick={() => removeAlbumPlacement(index)} className="admin-artists-page-danger-btn">
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="admin-modal-grid admin-song-album-grid">
                          <div className="admin-modal-field admin-modal-field-full">
                            <label className="admin-modal-label">Album</label>
                            <select value={placement.albumId} onChange={setAlbumPlacement(index, 'albumId')} className="admin-artists-page-input">
                              <option value="">- Album -</option>
                              {sortedAlbums.map((album) => (
                                <option key={album.id} value={album.id}>
                                  {album.title}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="admin-modal-field">
                            <label className="admin-modal-label">Track #</label>
                            <input type="number" placeholder="Track #" value={placement.trackNumber} onChange={setAlbumPlacement(index, 'trackNumber')} className="admin-artists-page-input" />
                          </div>
                          <div className="admin-modal-field">
                            <label className="admin-modal-label">Disc #</label>
                            <input type="number" placeholder="Disc #" value={placement.discNumber} onChange={setAlbumPlacement(index, 'discNumber')} className="admin-artists-page-input" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addAlbumPlacement} className="admin-artists-page-ghost-btn admin-song-add-album-btn">
                    {isArtistScoped ? 'Add Album Placement' : 'Add Album'}
                  </button>
                </TabPanel>
              </TabView>
            </div>
            <div className="admin-modal-footer">
              <button type="button" onClick={closeForm} className="admin-artists-page-ghost-btn">
                Cancel
              </button>
              <button type="button" onClick={handleSave} className="admin-artists-page-primary-btn">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
