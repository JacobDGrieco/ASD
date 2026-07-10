import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { FaApple, FaExternalLinkAlt, FaEye, FaEyeSlash, FaPencilAlt, FaSoundcloud, FaSpotify, FaTrash, FaYoutube } from 'react-icons/fa'
import { TabPanel, TabView } from 'primereact/tabview'
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx'
import AdminDateInput, { isValidDateInput } from '../../components/admin/AdminDateInput.jsx'
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import { clearAdminResource, loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js'
import AdminSongFormModal from '../../components/admin/AdminSongFormModal.jsx'
import { defaultVisibilityForReleaseDate, isEffectivelyVisible } from '../../lib/contentVisibility.js'
import { isOtherArtist, OTHER_ARTIST_NAME, OTHER_ARTIST_OPTION_ID } from '../../lib/publicVisibility.js'
import { slugify } from '../../lib/slugify.js'
import '../../styles/AdminArtistsPage.css'
import '../../styles/AdminAlbumsPage.css'

const PAGE_SIZE = 30

const empty = {
  title: '',
  slug: '',
  isVisible: true,
  autoShowOnRelease: false,
  type: '',
  images: [],
  otherArtistName: '',
  aboutText: '',
  soundcloudUrl: '',
  spotifyUrl: '',
  appleMusicUrl: '',
  youtubeUrl: '',
  releaseDate: '',
  artistId: '',
}

function iconLabel(icon, text) {
  return (
    <span className="admin-modal-label-with-icon">
      <span className="admin-modal-label-icon" aria-hidden="true">{icon}</span>
      <span>{text}</span>
    </span>
  )
}

const columns = [
  { key: 'images', label: 'Images', kind: 'images', className: 'admin-artists-page-col-image' },
  { key: 'title', label: 'Title', placeholder: 'Title', className: 'admin-artists-page-col-wide' },
  { key: 'artistId', label: 'Artist', kind: 'artist', className: 'admin-artists-page-col-sm' },
  { key: 'type', label: 'Type', kind: 'select', className: 'admin-artists-page-col-sm' },
  { key: 'releaseDate', label: 'Release Date', type: 'date', placeholder: 'Release Date', className: 'admin-artists-page-col-sm' },
  { key: 'soundcloudUrl', label: 'SoundCloud', placeholder: 'SoundCloud URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
  { key: 'spotifyUrl', label: 'Spotify', placeholder: 'Spotify URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
  { key: 'appleMusicUrl', label: 'Apple Music', placeholder: 'Apple Music URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
  { key: 'youtubeUrl', label: 'YouTube', placeholder: 'YouTube URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
]

function primaryImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null
  return images.find((image) => image.isPrimary) ?? images[0]
}

function isAlbumHidden(album) {
  return (
    (!isOtherArtist(album?.artist) && album?.artist?.isVisible === false) ||
    !isEffectivelyVisible(album, album?.releaseDate)
  )
}

function compareLexicographically(left, right) {
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
}

function withOtherArtistOption(artists) {
  return [...artists, { id: OTHER_ARTIST_OPTION_ID, name: OTHER_ARTIST_NAME }]
}

function normalizeAlbumDuplicateValue(value) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeAlbumReleaseDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function hasManualAlbumVisibilityChoice(album) {
  const defaultVisibility = defaultVisibilityForReleaseDate(album?.releaseDate)
  return (
    album?.isVisible !== defaultVisibility.isVisible ||
    Boolean(album?.autoShowOnRelease) !== defaultVisibility.autoShowOnRelease
  )
}

function validateAlbumForm(form, albums = []) {
  const errors = {}
  if (!form.title?.trim()) errors.title = 'Album title is required.'
  if (!form.artistId) errors.artistId = 'Artist is required.'
  if (form.artistId === OTHER_ARTIST_OPTION_ID && !form.otherArtistName?.trim()) errors.otherArtistName = 'Other artist name is required.'
  if (!form.type) errors.type = 'Album type is required.'
  if (!form.releaseDate) errors.releaseDate = 'Release date is required.'
  else if (!isValidDateInput(form.releaseDate, { required: true })) errors.releaseDate = 'Release date must use YYYY-MM-DD.'

  if (!errors.title && !errors.artistId && !errors.otherArtistName && !errors.releaseDate) {
    const normalizedTitle = normalizeAlbumDuplicateValue(form.title)
    const normalizedArtistId = form.artistId
    const normalizedOtherArtistName = normalizeAlbumDuplicateValue(form.otherArtistName)
    const normalizedReleaseDate = normalizeAlbumReleaseDate(form.releaseDate)

    const duplicateAlbum = albums.find((album) => {
      if (album.id === form.id) return false
      if (normalizeAlbumDuplicateValue(album.title) !== normalizedTitle) return false

      const albumArtistId = isOtherArtist(album.artist) ? OTHER_ARTIST_OPTION_ID : album.artistId
      if (albumArtistId !== normalizedArtistId) return false

      if (albumArtistId === OTHER_ARTIST_OPTION_ID) {
        if (normalizeAlbumDuplicateValue(album.otherArtistName) !== normalizedOtherArtistName) return false
      }

      return normalizeAlbumReleaseDate(album.releaseDate) === normalizedReleaseDate
    })

    if (duplicateAlbum) {
      errors.title = 'An album with this title, artist, and release date already exists.'
    }
  }

  return errors
}

export default function AdminMusicAlbumsPage() {
  const { token, session } = useAdminAuth()
  const isArtistScoped = session?.role === 'ARTIST'
  const isViewer = session?.role === 'VIEWER'
  const scopedArtistId = session?.artistId ?? ''
  const auth = { Authorization: `Bearer ${token}` }
  const [albums, setAlbums] = useState([])
  const [artists, setArtists] = useState([])
  const [form, setForm] = useState(null)
  const [filterArtist, setFilterArtist] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterTitle, setFilterTitle] = useState('')
  const [page, setPage] = useState(1)
  const [loadingEditId, setLoadingEditId] = useState(null)
  const [validationErrors, setValidationErrors] = useState({})
  const [visibilityTouched, setVisibilityTouched] = useState(false)
  const [createSongPrefill, setCreateSongPrefill] = useState(null)
  const deferredFilterTitle = useDeferredValue(filterTitle)

  useEffect(() => {
    let ignore = false

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

  useEffect(() => { setPage(1) }, [filterArtist, filterType, filterTitle])

  const filteredAlbums = useMemo(() => (
    albums.filter((album) => {
      if (filterArtist) {
        const matchesArtist = filterArtist === OTHER_ARTIST_OPTION_ID
          ? isOtherArtist(album.artist)
          : album.artistId === filterArtist
        if (!matchesArtist) return false
      }
      if (filterType && album.type !== filterType) return false
      if (deferredFilterTitle && !album.title.toLowerCase().includes(deferredFilterTitle.trim().toLowerCase())) return false
      return true
    })
  ), [albums, deferredFilterTitle, filterArtist, filterType])

  const artistOptions = useMemo(() => (
    withOtherArtistOption(artists).sort((left, right) =>
      compareLexicographically(left.name, right.name)
    )
  ), [artists])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredAlbums.length / PAGE_SIZE)), [filteredAlbums.length])
  const pagedAlbums = useMemo(
    () => filteredAlbums.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredAlbums, page]
  )

  const openCreate = () => {
    setValidationErrors({})
    setVisibilityTouched(false)
    setForm({
      ...empty,
      artistId: isArtistScoped ? scopedArtistId : filterArtist,
      type: filterType || empty.type,
    })
  }
  const openEdit = async (album) => {
    setLoadingEditId(album.id)
    try {
      const detail = await fetch(`/api/admin/albums?id=${album.id}`, { headers: auth }).then((r) => r.json())
      setVisibilityTouched(hasManualAlbumVisibilityChoice(detail))
      setForm({
        ...empty,
        ...detail,
        artistId: isOtherArtist(detail.artist) ? OTHER_ARTIST_OPTION_ID : detail.artistId,
        otherArtistName: detail.otherArtistName ?? '',
        images: detail.images ?? [],
        aboutText: detail.aboutText ?? '',
        soundcloudUrl: detail.soundcloudUrl ?? '',
        spotifyUrl: detail.spotifyUrl ?? '',
        appleMusicUrl: detail.appleMusicUrl ?? '',
        youtubeUrl: detail.youtubeUrl ?? '',
        releaseDate: detail.releaseDate ? detail.releaseDate.slice(0, 10) : '',
      })
      setValidationErrors({})
    } finally {
      setLoadingEditId(null)
    }
  }
  const closeForm = () => {
    setForm(null)
    setValidationErrors({})
    setVisibilityTouched(false)
  }

  const handleSave = async () => {
    const nextErrors = validateAlbumForm(form, albums)
    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors)
      return
    }
    setValidationErrors({})

    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/admin/albums?id=${form.id}` : '/api/admin/albums'
    const payload = {
      ...form,
      slug: slugify(form.title),
      ...(isArtistScoped ? { artistId: scopedArtistId } : {}),
    }
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to save album.' }))
      window.alert(error.error ?? 'Failed to save album.')
      return
    }
    const saved = await res.json()
    const withArtist = { ...saved, artist: saved.artist ?? artists.find((artist) => artist.id === saved.artistId) ?? null }
    const nextAlbums = isEdit ? albums.map((album) => (album.id === saved.id ? withArtist : album)) : [...albums, withArtist]
    setAlbums(nextAlbums)
    primeAdminResource('albums-list', token, nextAlbums)
    closeForm()

    if (!isEdit && saved.type === 'SINGLE') {
      setCreateSongPrefill({
        albumId: saved.id,
        title: saved.title ?? '',
        releaseDate: saved.releaseDate ? String(saved.releaseDate).slice(0, 10) : '',
        soundcloudUrl: saved.soundcloudUrl ?? '',
        spotifyUrl: saved.spotifyUrl ?? '',
        appleMusicUrl: saved.appleMusicUrl ?? '',
        youtubeUrl: saved.youtubeUrl ?? '',
      })
    }
  }

  const handleDelete = async (id) => {
    await fetch(`/api/admin/albums?id=${id}`, { method: 'DELETE', headers: auth })
    const nextAlbums = albums.filter((album) => album.id !== id)
    setAlbums(nextAlbums)
    primeAdminResource('albums-list', token, nextAlbums)
  }

  const handleSongSaved = () => {
    clearAdminResource('songs-list', token)
    setCreateSongPrefill(null)
  }

  const set = (key) => (event) => setForm((current) => {
    const nextValue = event.target.value
    setValidationErrors((currentErrors) => {
      if (!(key in currentErrors) && !(key === 'artistId' && 'otherArtistName' in currentErrors)) return currentErrors
      const nextErrors = { ...currentErrors }
      delete nextErrors[key]
      if (key === 'artistId') delete nextErrors.otherArtistName
      return nextErrors
    })

    return {
      ...current,
      [key]: nextValue,
      ...(key === 'title' ? { slug: slugify(nextValue) } : {}),
      ...(key === 'artistId' && nextValue !== OTHER_ARTIST_OPTION_ID ? { otherArtistName: '' } : {}),
    }
  })

  const fieldClassName = (fieldName) => (
    `admin-artists-page-input${validationErrors[fieldName] ? ' admin-artists-page-input-invalid' : ''}`
  )

  const setReleaseDate = (value) => setForm((current) => {
    setValidationErrors((currentErrors) => {
      if (!('releaseDate' in currentErrors)) return currentErrors
      const nextErrors = { ...currentErrors }
      delete nextErrors.releaseDate
      return nextErrors
    })

    return {
      ...current,
      releaseDate: value,
      ...(!visibilityTouched ? defaultVisibilityForReleaseDate(value) : {}),
    }
  })

  const renderValue = (album, column) => {
    if (column.key === 'artistId') {
      const artistLabel = isOtherArtist(album.artist)
        ? album.otherArtistName || OTHER_ARTIST_NAME
        : album.artist?.name
      return artistLabel ? <span className="admin-artists-page-cell-value" title={artistLabel}>{artistLabel}</span> : <span className="admin-artists-page-empty-value">-</span>
    }

    if (column.key === 'releaseDate') {
      const value = album.releaseDate ? album.releaseDate.slice(0, 10) : ''
      return value ? <span className="admin-artists-page-cell-value" title={value}>{value}</span> : <span className="admin-artists-page-empty-value">-</span>
    }

    if (column.kind === 'link') {
      const value = album[column.key]
      return value
        ? (
          <a
            href={String(value)}
            target="_blank"
            rel="noreferrer"
            className="admin-artists-page-link-btn"
            aria-label={`Open ${column.label} in new tab`}
            title="Open in new tab"
          >
            <FaExternalLinkAlt aria-hidden="true" />
          </a>
        )
        : <span className="admin-artists-page-empty-value">-</span>
    }

    if (column.kind === 'images') {
      const image = primaryImage(album.images)
      if (!image) return <span className="admin-artists-page-empty-value">-</span>
      return (
        <div className="admin-artists-page-image-summary">
          <div className={`admin-artists-page-thumb-frame ${isAlbumHidden(album) ? 'admin-artists-page-thumb-frame-hidden' : ''}`.trim()}>
            <img src={image.previewUrl || image.url} alt={album.title} className="admin-artists-page-thumb" />
          </div>
          <span className="admin-artists-page-image-count">{album.imageCount ?? album.images?.length ?? 1} image{(album.imageCount ?? album.images?.length ?? 1) === 1 ? '' : 's'}</span>
        </div>
      )
    }

    const value = album[column.key]
    if (value === null || value === undefined || value === '') return <span className="admin-artists-page-empty-value">-</span>
    return <span className={column.valueClassName ?? 'admin-artists-page-cell-value'} title={String(value)}>{String(value)}</span>
  }

  const renderHeader = (column) => {
    if (column.key === 'soundcloudUrl') return <span className="admin-artists-page-social-header" aria-label="SoundCloud"><FaSoundcloud aria-hidden="true" /></span>
    if (column.key === 'spotifyUrl') return <span className="admin-artists-page-social-header" aria-label="Spotify"><FaSpotify aria-hidden="true" /></span>
    if (column.key === 'appleMusicUrl') return <span className="admin-artists-page-social-header" aria-label="Apple Music"><FaApple aria-hidden="true" /></span>
    if (column.key === 'youtubeUrl') return <span className="admin-artists-page-social-header" aria-label="YouTube"><FaYoutube aria-hidden="true" /></span>
    return column.label
  }

  return (
    <div>
      <div className="admin-artists-page-sticky-top">
        <div className="admin-artists-page-header">
          <h1 className="admin-artists-page-title">Music — Albums</h1>
          {!isViewer && <button onClick={openCreate} className="admin-artists-page-primary-btn">New Album</button>}
        </div>

        <div className="admin-filter-bar">
          <input
            type="search"
            value={filterTitle}
            onChange={(e) => setFilterTitle(e.target.value)}
            className="admin-filter-select"
            placeholder="Search title..."
          />
          {!isArtistScoped && (
            <select
              value={filterArtist}
              onChange={(e) => setFilterArtist(e.target.value)}
              className="admin-filter-select"
            >
              <option value="">All Artists</option>
              {artistOptions.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
            </select>
          )}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="admin-filter-select"
          >
            <option value="">All Types</option>
            <option value="ALBUM">Album</option>
            <option value="SINGLE">Single</option>
            <option value="EP">EP</option>
          </select>
        </div>
      </div>

      {!form && (
        <div className="admin-artists-page-table-wrap">
          <table className="admin-artists-page-table">
            <thead>
              <tr>
                {columns.map((column) => <th key={column.key} className={column.className}>{renderHeader(column)}</th>)}
                <th className="admin-artists-page-actions-col admin-artists-page-sticky-right-0"></th>
              </tr>
            </thead>
            <tbody>
              {pagedAlbums.map((album) => (
                <tr key={album.id} className={isAlbumHidden(album) ? 'admin-artists-page-hidden-row' : ''}>
                  {columns.map((column) => (
                    <td key={column.key} className={`${column.className ?? ''} ${column.key === 'type' ? 'admin-artists-page-muted' : ''}`.trim()}>
                      {renderValue(album, column)}
                    </td>
                  ))}
                  <td className="admin-artists-page-action-cell admin-artists-page-actions-col admin-artists-page-sticky-right-0">
                    <div className="admin-artists-page-actions">
                      {!isViewer && (
                        <button type="button" onClick={() => void openEdit(album)} disabled={loadingEditId === album.id} className="admin-artists-page-ghost-btn admin-artists-page-icon-btn" aria-label="Edit album" title="Edit">
                          <FaPencilAlt aria-hidden="true" />
                        </button>
                      )}
                      {!isViewer && (
                        <ConfirmActionButton
                          message="Delete this album and all its songs?"
                          onConfirm={() => handleDelete(album.id)}
                          buttonClassName="admin-artists-page-danger-btn admin-artists-page-icon-btn"
                          buttonAriaLabel="Delete album"
                          buttonTitle="Delete"
                        >
                          <FaTrash aria-hidden="true" />
                        </ConfirmActionButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!form && totalPages > 1 && (
        <div className="admin-pagination">
          <button
            type="button"
            className="admin-pagination-btn"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
          >
            ← Prev
          </button>
          <span className="admin-pagination-info">Page {page} of {totalPages}</span>
          <button
            type="button"
            className="admin-pagination-btn"
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages}
          >
            Next →
          </button>
        </div>
      )}

      {createSongPrefill && (
        <AdminSongFormModal
          songId={null}
          prefill={createSongPrefill}
          songs={[]}
          albums={albums}
          token={token}
          session={session}
          onSaved={handleSongSaved}
          onClose={() => setCreateSongPrefill(null)}
        />
      )}

      {form && (
        <div className="admin-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{form.id ? 'Edit Album' : 'New Album'}</h2>
              <button type="button" onClick={closeForm} className="admin-modal-close" aria-label="Close">×</button>
            </div>
            <div className="admin-modal-body">
              <TabView className="page-tabview admin-modal-tabs">
                <TabPanel header="Album">
                  <div className="admin-modal-grid">
                    <div className="admin-modal-field admin-modal-field-full">
                      <div className="admin-artists-page-name-field">
                        <button
                          type="button"
                          onClick={() => {
                            setVisibilityTouched(true)
                            setForm((current) => ({
                              ...current,
                              isVisible: !current.isVisible,
                              autoShowOnRelease: false,
                            }))
                          }}
                          className={`admin-artists-page-visibility-toggle ${form.isVisible ? '' : 'admin-artists-page-visibility-toggle-hidden'}`.trim()}
                          aria-label={form.isVisible ? 'Album is visible to the public. Click to hide.' : 'Album is hidden from the public. Click to show.'}
                          title={form.isVisible ? 'Visible on public site' : 'Hidden from public site'}
                        >
                          {form.isVisible ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />}
                        </button>
                        <div className="admin-artists-page-name-field-main">
                          <label htmlFor="admin-music-album-title" className="admin-modal-label">Title <span className="admin-modal-label-required">*</span></label>
                          <input id="admin-music-album-title" type="text" placeholder="Title" value={form.title} onChange={set('title')} className={fieldClassName('title')} aria-invalid={Boolean(validationErrors.title)} />
                        </div>
                      </div>
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <div className="admin-modal-label">Images</div>
                      <ImageCollectionField
                        value={form.images}
                        onChange={(images) => setForm((current) => ({ ...current, images }))}
                        token={token}
                        folder="albums"
                        entityLabel={form.title || 'Album image'}
                      />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full admin-albums-modal-meta-row">
                      <div className="admin-modal-field admin-albums-modal-meta-artist">
                        <label htmlFor="admin-music-album-artist" className="admin-modal-label">Artist <span className="admin-modal-label-required">*</span></label>
                        {isArtistScoped ? (
                          <input
                            id="admin-music-album-artist"
                            type="text"
                            value={artistOptions.find((artist) => artist.id === scopedArtistId)?.name ?? ''}
                            className="admin-artists-page-input"
                            readOnly
                          />
                        ) : (
                          <select id="admin-music-album-artist" value={form.artistId} onChange={set('artistId')} className={fieldClassName('artistId')} aria-invalid={Boolean(validationErrors.artistId)}>
                            <option value="">- Artist -</option>
                            {artistOptions.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
                          </select>
                        )}
                      </div>
                      <div className="admin-modal-field admin-albums-modal-meta-type">
                        <label htmlFor="admin-music-album-type" className="admin-modal-label">Type <span className="admin-modal-label-required">*</span></label>
                        <select id="admin-music-album-type" value={form.type} onChange={set('type')} className={fieldClassName('type')} aria-invalid={Boolean(validationErrors.type)}>
                          <option value="">- Type -</option>
                          <option value="ALBUM">Album</option>
                          <option value="SINGLE">Single</option>
                          <option value="EP">EP</option>
                        </select>
                      </div>
                      <div className="admin-modal-field admin-albums-modal-meta-date">
                        <label htmlFor="admin-music-album-release-date" className="admin-modal-label">Release Date <span className="admin-modal-label-required">*</span></label>
                        <AdminDateInput id="admin-music-album-release-date" value={form.releaseDate} onChange={setReleaseDate} className={fieldClassName('releaseDate')} ariaInvalid={Boolean(validationErrors.releaseDate)} required />
                      </div>
                    </div>
                    {form.artistId === OTHER_ARTIST_OPTION_ID && (
                      <div className="admin-modal-field admin-modal-field-full">
                        <label htmlFor="admin-music-album-other-artist-name" className="admin-modal-label">Other Artist Name <span className="admin-modal-label-required">*</span></label>
                        <input id="admin-music-album-other-artist-name" type="text" placeholder="Artist name" value={form.otherArtistName} onChange={set('otherArtistName')} className={fieldClassName('otherArtistName')} aria-invalid={Boolean(validationErrors.otherArtistName)} />
                      </div>
                    )}
                    <div className="admin-modal-field admin-modal-field-full">
                      <label htmlFor="admin-music-album-about" className="admin-modal-label">About</label>
                      <textarea id="admin-music-album-about" placeholder="About this album..." value={form.aboutText} onChange={set('aboutText')} className="admin-artists-page-input admin-modal-textarea" rows={5} />
                    </div>
                  </div>
                </TabPanel>
                <TabPanel header="Links">
                  <div className="admin-modal-grid">
                    <div className="admin-modal-field admin-modal-field-full">
                      <label htmlFor="admin-music-album-soundcloud" className="admin-modal-label">{iconLabel(<FaSoundcloud />, 'SoundCloud URL')}</label>
                      <input id="admin-music-album-soundcloud" type="url" placeholder="SoundCloud URL" value={form.soundcloudUrl} onChange={set('soundcloudUrl')} className="admin-artists-page-input" />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label htmlFor="admin-music-album-spotify" className="admin-modal-label">{iconLabel(<FaSpotify />, 'Spotify URL')}</label>
                      <input id="admin-music-album-spotify" type="url" placeholder="Spotify URL" value={form.spotifyUrl} onChange={set('spotifyUrl')} className="admin-artists-page-input" />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label htmlFor="admin-music-album-apple-music" className="admin-modal-label">{iconLabel(<FaApple />, 'Apple Music URL')}</label>
                      <input id="admin-music-album-apple-music" type="url" placeholder="Apple Music URL" value={form.appleMusicUrl} onChange={set('appleMusicUrl')} className="admin-artists-page-input" />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label htmlFor="admin-music-album-youtube" className="admin-modal-label">{iconLabel(<FaYoutube />, 'YouTube URL')}</label>
                      <input id="admin-music-album-youtube" type="url" placeholder="YouTube URL" value={form.youtubeUrl} onChange={set('youtubeUrl')} className="admin-artists-page-input" />
                    </div>
                  </div>
                </TabPanel>
              </TabView>
            </div>
            <div className="admin-modal-footer">
              <button type="button" onClick={closeForm} className="admin-artists-page-ghost-btn">Cancel</button>
              <button type="button" onClick={handleSave} className="admin-artists-page-primary-btn">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
