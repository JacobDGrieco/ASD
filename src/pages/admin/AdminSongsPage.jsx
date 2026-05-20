import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { TabPanel, TabView } from 'primereact/tabview'
import { FaArrowLeft, FaArrowRight, FaExternalLinkAlt, FaEye, FaEyeSlash, FaPencilAlt, FaStickyNote, FaTimes, FaTrash } from 'react-icons/fa'
import { SiApplemusic, SiSoundcloud, SiSpotify, SiYoutube } from 'react-icons/si'
import AdminDateInput, { isValidDateInput } from '../../components/admin/AdminDateInput.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx'
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js'
import { defaultVisibilityForReleaseDate, isEffectivelyVisible } from '../../lib/contentVisibility.js'
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
    trackNumber: '',
    discNumber: 1,
  }
}

const empty = {
  title: '',
  slug: '',
  isVisible: true,
  autoShowOnRelease: false,
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

function createSongFormFromAlbumPrefill(prefill = {}) {
  return {
    ...empty,
    title: prefill.title ?? '',
    releaseDate: prefill.releaseDate ?? '',
    soundcloudUrl: prefill.soundcloudUrl ?? '',
    spotifyUrl: prefill.spotifyUrl ?? '',
    appleMusicUrl: prefill.appleMusicUrl ?? '',
    youtubeUrl: prefill.youtubeUrl ?? '',
    ...defaultVisibilityForReleaseDate(prefill.releaseDate ?? ''),
    albumPlacements: [
      {
        ...createAlbumPlacement(),
        albumId: prefill.albumId ?? '',
        trackNumber: 1,
        discNumber: 1,
      },
    ],
  }
}

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

function normalizeSongDuplicateValue(value) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeSongReleaseDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function songReleaseDate(song) {
  return song?.meta?.releaseDate ? String(song.meta.releaseDate).slice(0, 10) : ''
}

function hasManualSongVisibilityChoice(song) {
  const releaseDate = song?.meta?.releaseDate ?? song?.placements?.[0]?.album?.releaseDate ?? ''
  const defaultVisibility = defaultVisibilityForReleaseDate(releaseDate)
  return (
    song?.isVisible !== defaultVisibility.isVisible ||
    Boolean(song?.autoShowOnRelease) !== defaultVisibility.autoShowOnRelease
  )
}

function albumArtistKey(album) {
  if (!album) return ''
  if (isOtherArtist(album.artist)) {
    return `other:${normalizeSongDuplicateValue(album.otherArtistName || OTHER_ARTIST_NAME)}`
  }

  return `artist:${album.artistId ?? album.artist?.id ?? ''}`
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

function validateSongForm(form, songs = [], albumById = {}) {
  const errors = {
    title: '',
    releaseDate: '',
    albumPlacementsRoot: '',
    albumPlacements: Array.isArray(form.albumPlacements)
      ? form.albumPlacements.map(() => ({ albumId: '', trackNumber: '', discNumber: '' }))
      : [],
  }

  if (!form.title?.trim()) errors.title = 'Song title is required.'
  if (form.releaseDate && !isValidDateInput(form.releaseDate)) errors.releaseDate = 'Release date must use YYYY-MM-DD.'
  if (!Array.isArray(form.albumPlacements) || form.albumPlacements.length === 0) {
    errors.albumPlacementsRoot = 'At least one album is required.'
    return errors
  }

  const seenAlbumIds = new Set()
  for (const [index, placement] of form.albumPlacements.entries()) {
    if (!placement.albumId) errors.albumPlacements[index].albumId = 'Each album card must have an album selected.'
    if (placement.albumId && seenAlbumIds.has(placement.albumId)) errors.albumPlacements[index].albumId = 'Each album can only be selected once per song.'
    if (!placement.trackNumber || Number(placement.trackNumber) < 1) errors.albumPlacements[index].trackNumber = 'Track number must be at least 1.'
    if (!placement.discNumber || Number(placement.discNumber) < 1) errors.albumPlacements[index].discNumber = 'Disc number must be at least 1.'
    seenAlbumIds.add(placement.albumId)
  }

  if (!errors.title && !errors.releaseDate && !errors.albumPlacementsRoot && !errors.albumPlacements.some((placement) => placement.albumId || placement.trackNumber || placement.discNumber)) {
    const normalizedTitle = normalizeSongDuplicateValue(form.title)
    const normalizedReleaseDate = normalizeSongReleaseDate(form.releaseDate)
    const selectedAlbumIds = [...new Set(form.albumPlacements.map((placement) => placement.albumId).filter(Boolean))]

    const duplicateSong = songs.find((song) => {
      if (song.id === form.id) return false
      if (normalizeSongDuplicateValue(song.title) !== normalizedTitle) return false
      if (normalizeSongReleaseDate(songReleaseDate(song)) !== normalizedReleaseDate) return false

      return placementAlbumIds(song).some((albumId) => {
        if (!selectedAlbumIds.includes(albumId)) return false

        const selectedAlbum = albumById[albumId]
        const existingAlbum = albumById[albumId] ?? song.placements?.find((placement) => placement.albumId === albumId)?.album ?? null

        return (
          normalizeSongDuplicateValue(selectedAlbum?.title) === normalizeSongDuplicateValue(existingAlbum?.title) &&
          albumArtistKey(selectedAlbum) === albumArtistKey(existingAlbum)
        )
      })
    })

    if (duplicateSong) {
      errors.title = 'A song with this title, album, artist, and release date already exists.'
    }
  }

  return errors
}

function hasSongValidationErrors(errors) {
  if (!errors) return false
  if (errors.title || errors.albumPlacementsRoot) return true
  return Array.isArray(errors.albumPlacements) && errors.albumPlacements.some((placement) => placement.albumId || placement.trackNumber || placement.discNumber)
}

function hasSongInfoErrors(errors) {
  return Boolean(errors?.title || errors?.releaseDate)
}

function hasAlbumErrors(errors) {
  if (!errors) return false
  if (errors.albumPlacementsRoot) return true
  return Array.isArray(errors.albumPlacements) && errors.albumPlacements.some((placement) => placement.albumId || placement.trackNumber || placement.discNumber)
}

export default function AdminSongsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { token, session } = useAdminAuth()
  const isArtistScoped = session?.role === 'ARTIST'
  const isViewer = session?.role === 'VIEWER'
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
  const [validationErrors, setValidationErrors] = useState(null)
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const [visibilityTouched, setVisibilityTouched] = useState(false)
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

  const openCreate = () => {
    setValidationErrors(null)
    setActiveTabIndex(0)
    setVisibilityTouched(false)
    setForm(createSongFormFromAlbumPrefill({
      albumId: filterAlbum,
      releaseDate: filterAlbum ? albumById[filterAlbum]?.releaseDate?.slice?.(0, 10) ?? '' : '',
    }))
  }
  const openEdit = async (song) => {
    setLoadingEditId(song.id)
    try {
      const detail = await fetch(`/api/admin/songs?id=${song.id}`, { headers: auth }).then((response) => response.json())
      setVisibilityTouched(hasManualSongVisibilityChoice(detail))
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
      setValidationErrors(null)
      setActiveTabIndex(0)
    } finally {
      setLoadingEditId(null)
    }
  }
  const closeForm = () => {
    setForm(null)
    setValidationErrors(null)
    setActiveTabIndex(0)
    setVisibilityTouched(false)
  }

  useEffect(() => {
    const prefill = location.state?.createFromAlbum
    if (!prefill || form) return

    setValidationErrors(null)
    setActiveTabIndex(0)
    setVisibilityTouched(false)
    if (prefill.artistId) setFilterArtist(prefill.artistId)
    if (prefill.albumId) setFilterAlbum(prefill.albumId)
    setForm(createSongFormFromAlbumPrefill(prefill))
    navigate(location.pathname, { replace: true, state: null })
  }, [form, location.pathname, location.state, navigate])

  const handleSave = async () => {
    const nextErrors = validateSongForm(form, songs, albumById)
    if (hasSongValidationErrors(nextErrors)) {
      setValidationErrors(nextErrors)
      if (hasAlbumErrors(nextErrors) && !hasSongInfoErrors(nextErrors)) {
        setActiveTabIndex(1)
      }
      return
    }
    setValidationErrors(null)

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
    setForm((current) => {
      const nextValue = event.target.value
      setValidationErrors((currentErrors) => currentErrors ? { ...currentErrors, [key]: '' } : currentErrors)
      return {
        ...current,
        [key]: nextValue,
        ...(key === 'title' ? { slug: slugify(nextValue) } : {}),
      }
    })

  const setReleaseDate = (value) =>
    setForm((current) => {
      setValidationErrors((currentErrors) => currentErrors ? { ...currentErrors, releaseDate: '' } : currentErrors)
      return {
        ...current,
        releaseDate: value,
        ...(!visibilityTouched ? defaultVisibilityForReleaseDate(value) : {}),
      }
    })

  const setAlbumPlacement = (index, key) => (event) =>
    setForm((current) => {
      const nextValue = key === 'albumId'
        ? event.target.value
        : event.target.value === ''
          ? ''
          : Number(event.target.value)

      setValidationErrors((currentErrors) => {
        if (!currentErrors?.albumPlacements?.[index]) return currentErrors
        return {
          ...currentErrors,
          albumPlacementsRoot: '',
          albumPlacements: currentErrors.albumPlacements.map((placementErrors, placementIndex) =>
            placementIndex === index
              ? { ...placementErrors, [key]: '' }
              : placementErrors
          ),
        }
      })

      return {
        ...current,
        albumPlacements: current.albumPlacements.map((placement, placementIndex) =>
          placementIndex === index
            ? {
                ...placement,
                [key]: nextValue,
              }
            : placement
        ),
        ...(() => {
          if (current.releaseDate || visibilityTouched) return {}
          const nextPlacements = current.albumPlacements.map((placement, placementIndex) =>
            placementIndex === index ? { ...placement, [key]: nextValue } : placement
          )
          const primaryAlbumReleaseDate = albumById[nextPlacements[0]?.albumId]?.releaseDate?.slice?.(0, 10) ?? ''
          return defaultVisibilityForReleaseDate(primaryAlbumReleaseDate)
        })(),
      }
    })

  const addAlbumPlacement = () =>
    setForm((current) => {
      setValidationErrors((currentErrors) => currentErrors
        ? {
            ...currentErrors,
            albumPlacementsRoot: '',
            albumPlacements: [...(currentErrors.albumPlacements ?? []), { albumId: '', trackNumber: '', discNumber: '' }],
          }
        : currentErrors)

      return {
        ...current,
        albumPlacements: [...current.albumPlacements, createAlbumPlacement()],
      }
    })

  const removeAlbumPlacement = (index) =>
    setForm((current) => {
      setValidationErrors((currentErrors) => currentErrors
        ? {
            ...currentErrors,
            albumPlacementsRoot: '',
            albumPlacements: (currentErrors.albumPlacements ?? []).filter((_, placementIndex) => placementIndex !== index),
          }
        : currentErrors)

      return {
        ...current,
        albumPlacements: current.albumPlacements.filter((_, placementIndex) => placementIndex !== index),
        ...(() => {
          if (current.releaseDate || visibilityTouched) return {}
          const nextPlacements = current.albumPlacements.filter((_, placementIndex) => placementIndex !== index)
          const primaryAlbumReleaseDate = albumById[nextPlacements[0]?.albumId]?.releaseDate?.slice?.(0, 10) ?? ''
          return defaultVisibilityForReleaseDate(primaryAlbumReleaseDate)
        })(),
      }
    })

  const songFieldClassName = (fieldName) => (
    `admin-artists-page-input${validationErrors?.[fieldName] ? ' admin-artists-page-input-invalid' : ''}`
  )

  const placementFieldClassName = (index, fieldName) => (
    `admin-artists-page-input${validationErrors?.albumPlacements?.[index]?.[fieldName] ? ' admin-artists-page-input-invalid' : ''}`
  )

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
        <div className={`admin-artists-page-thumb-frame ${isSongHidden(song) ? 'admin-artists-page-thumb-frame-hidden' : ''}`.trim()}>
          <img src={image.previewUrl || image.url} alt={song.title} className="admin-artists-page-thumb" />
        </div>
        <span className="admin-artists-page-image-count">
          {song.imageCount ?? song.images?.length ?? 1} image{(song.imageCount ?? song.images?.length ?? 1) === 1 ? '' : 's'}
        </span>
      </div>
    )
  }

  return (
    <div>
      <div className="admin-artists-page-sticky-top">
        <div className="admin-artists-page-header">
          <h1 className="admin-artists-page-title">Songs</h1>
          {!isViewer && (
            <button onClick={openCreate} className="admin-artists-page-primary-btn">
              New Song
            </button>
          )}
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
                <tr key={song.id} className={isSongHidden(song) ? 'admin-artists-page-hidden-row' : ''}>
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
                      {!isViewer && (
                        <button type="button" onClick={() => void openEdit(song)} disabled={loadingEditId === song.id} className="admin-artists-page-ghost-btn admin-artists-page-icon-btn" aria-label="Edit song" title="Edit">
                          <FaPencilAlt aria-hidden="true" />
                        </button>
                      )}
                      {!isViewer && (
                        <ConfirmActionButton
                          message="Delete this song and all its lyrics/annotations?"
                          onConfirm={() => handleDelete(song.id)}
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
              <TabView activeIndex={activeTabIndex} onTabChange={(event) => setActiveTabIndex(event.index)} className="page-tabview admin-song-editor-tabs">
                <TabPanel header="Song Info">
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
                          aria-label={form.isVisible ? 'Song is visible to the public. Click to hide.' : 'Song is hidden from the public. Click to show.'}
                          title={form.isVisible ? 'Visible on public site' : 'Hidden from public site'}
                        >
                          {form.isVisible ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />}
                        </button>
                        <div className="admin-artists-page-name-field-main">
                          <label className="admin-modal-label">Title <span className="admin-modal-label-required">*</span></label>
                          <input type="text" placeholder="Title" value={form.title} onChange={set('title')} className={songFieldClassName('title')} aria-invalid={Boolean(validationErrors?.title)} />
                        </div>
                      </div>
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
                      <AdminDateInput value={form.releaseDate} onChange={setReleaseDate} className={songFieldClassName('releaseDate')} ariaInvalid={Boolean(validationErrors?.releaseDate)} />
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
                            <label className="admin-modal-label">Album <span className="admin-modal-label-required">*</span></label>
                            <select value={placement.albumId} onChange={setAlbumPlacement(index, 'albumId')} className={placementFieldClassName(index, 'albumId')} aria-invalid={Boolean(validationErrors?.albumPlacements?.[index]?.albumId)}>
                              <option value="">- Album -</option>
                              {sortedAlbums.map((album) => (
                                <option key={album.id} value={album.id}>
                                  {album.title}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="admin-modal-field">
                            <label className="admin-modal-label">Track # <span className="admin-modal-label-required">*</span></label>
                            <input type="number" placeholder="Track #" value={placement.trackNumber} onChange={setAlbumPlacement(index, 'trackNumber')} className={placementFieldClassName(index, 'trackNumber')} aria-invalid={Boolean(validationErrors?.albumPlacements?.[index]?.trackNumber)} />
                          </div>
                          <div className="admin-modal-field">
                            <label className="admin-modal-label">Disc # <span className="admin-modal-label-required">*</span></label>
                            <input type="number" placeholder="Disc #" value={placement.discNumber} onChange={setAlbumPlacement(index, 'discNumber')} className={placementFieldClassName(index, 'discNumber')} aria-invalid={Boolean(validationErrors?.albumPlacements?.[index]?.discNumber)} />
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
