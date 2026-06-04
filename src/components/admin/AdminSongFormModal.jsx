import { useEffect, useMemo, useState } from 'react'
import { TabPanel, TabView } from 'primereact/tabview'
import { FaEye, FaEyeSlash, FaTimes } from 'react-icons/fa'
import { SiApplemusic, SiSoundcloud, SiSpotify, SiYoutube } from 'react-icons/si'
import AdminDateInput, { isValidDateInput } from './AdminDateInput.jsx'
import ImageCollectionField from './ImageCollectionField.jsx'
import ChipInputField from './ChipInputField.jsx'
import { SONG_ROLES } from '../../lib/songRoles.js'
import { defaultVisibilityForReleaseDate } from '../../lib/contentVisibility.js'
import { isOtherArtist, OTHER_ARTIST_NAME } from '../../lib/publicVisibility.js'
import { slugify } from '../../lib/slugify.js'
import '../../styles/AdminArtistsPage.css'
import '../../styles/AdminSongsPage.css'

function createAlbumPlacement() {
  return { albumId: '', trackNumber: '', discNumber: 1 }
}

const emptyForm = {
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
  roles: [],
  releaseDate: '',
  images: [],
  tags: [],
  albumPlacements: [createAlbumPlacement()],
}

function iconLabel(icon, text) {
  return (
    <span className="admin-modal-label-with-icon">
      <span className="admin-modal-label-icon" aria-hidden="true">{icon}</span>
      <span>{text}</span>
    </span>
  )
}

function normalizeSongDuplicateValue(value) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeSongReleaseDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
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
  if (Array.isArray(song.placements) && song.placements.length) return song.placements.map((p) => p.albumId)
  return song.albumId ? [song.albumId] : []
}

function buildPlacementForm(song) {
  if (Array.isArray(song.albumPlacements) && song.albumPlacements.length) {
    return song.albumPlacements.map((p) => ({
      albumId: p.albumId ?? '',
      trackNumber: Number(p.trackNumber ?? 1),
      discNumber: Number(p.discNumber ?? 1),
    }))
  }
  if (Array.isArray(song.placements) && song.placements.length) {
    return song.placements.map((p) => ({
      albumId: p.albumId ?? p.album?.id ?? '',
      trackNumber: Number(p.trackNumber ?? 1),
      discNumber: Number(p.discNumber ?? 1),
    }))
  }
  if (song.albumId) {
    return [{ albumId: song.albumId, trackNumber: Number(song.trackNumber ?? 1), discNumber: Number(song.discNumber ?? 1) }]
  }
  return [createAlbumPlacement()]
}

function hasManualSongVisibilityChoice(song) {
  const releaseDate = song?.meta?.releaseDate ?? song?.placements?.[0]?.album?.releaseDate ?? ''
  const defaultVisibility = defaultVisibilityForReleaseDate(releaseDate)
  return (
    song?.isVisible !== defaultVisibility.isVisible ||
    Boolean(song?.autoShowOnRelease) !== defaultVisibility.autoShowOnRelease
  )
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

  if (!errors.title && !errors.releaseDate && !errors.albumPlacementsRoot && !errors.albumPlacements.some((p) => p.albumId || p.trackNumber || p.discNumber)) {
    const normalizedTitle = normalizeSongDuplicateValue(form.title)
    const normalizedReleaseDate = normalizeSongReleaseDate(form.releaseDate)
    const selectedAlbumIds = [...new Set(form.albumPlacements.map((p) => p.albumId).filter(Boolean))]

    const duplicateSong = songs.find((song) => {
      if (song.id === form.id) return false
      if (normalizeSongDuplicateValue(song.title) !== normalizedTitle) return false
      if (normalizeSongReleaseDate(song.meta?.releaseDate) !== normalizedReleaseDate) return false
      return placementAlbumIds(song).some((albumId) => {
        if (!selectedAlbumIds.includes(albumId)) return false
        const selectedAlbum = albumById[albumId]
        const existingAlbum = albumById[albumId] ?? song.placements?.find((p) => p.albumId === albumId)?.album ?? null
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
  return Array.isArray(errors.albumPlacements) && errors.albumPlacements.some((p) => p.albumId || p.trackNumber || p.discNumber)
}

function hasSongInfoErrors(errors) {
  return Boolean(errors?.title || errors?.releaseDate)
}

function hasAlbumErrors(errors) {
  if (!errors) return false
  if (errors.albumPlacementsRoot) return true
  return Array.isArray(errors.albumPlacements) && errors.albumPlacements.some((p) => p.albumId || p.trackNumber || p.discNumber)
}

function initFormFromPrefill(prefill = {}) {
  return {
    ...emptyForm,
    title: prefill.title ?? '',
    releaseDate: prefill.releaseDate ?? '',
    soundcloudUrl: prefill.soundcloudUrl ?? '',
    spotifyUrl: prefill.spotifyUrl ?? '',
    appleMusicUrl: prefill.appleMusicUrl ?? '',
    youtubeUrl: prefill.youtubeUrl ?? '',
    ...defaultVisibilityForReleaseDate(prefill.releaseDate ?? ''),
    albumPlacements: [{
      ...createAlbumPlacement(),
      albumId: prefill.albumId ?? '',
      trackNumber: 1,
      discNumber: 1,
    }],
  }
}

export default function AdminSongFormModal({
  songId,
  prefill,
  songs,
  albums,
  token,
  session,
  onSaved,
  onClose,
}) {
  const isArtistScoped = session?.role === 'ARTIST'
  const isViewer = session?.role === 'VIEWER'

  const [form, setForm] = useState(null)
  const [validationErrors, setValidationErrors] = useState(null)
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const [visibilityTouched, setVisibilityTouched] = useState(false)
  const [loading, setLoading] = useState(Boolean(songId))

  const albumById = useMemo(
    () => Object.fromEntries(albums.map((album) => [album.id, album])),
    [albums]
  )

  const sortedAlbums = useMemo(
    () => [...albums].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true })),
    [albums]
  )

  useEffect(() => {
    if (!songId) {
      setForm(initFormFromPrefill(prefill ?? {}))
      setVisibilityTouched(false)
      setValidationErrors(null)
      setActiveTabIndex(0)
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`/api/admin/songs?id=${songId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((detail) => {
        setVisibilityTouched(hasManualSongVisibilityChoice(detail))
        setForm({
          ...emptyForm,
          ...detail,
          images: detail.images ?? [],
          aboutText: detail.meta?.aboutText ?? '',
          roles: Array.isArray(detail.meta?.roles) ? detail.meta.roles : [],
          tags: detail.meta?.tags ?? [],
          releaseDate: detail.meta?.releaseDate ? detail.meta.releaseDate.slice(0, 10) : '',
          albumPlacements: buildPlacementForm(detail),
        })
        setValidationErrors(null)
        setActiveTabIndex(0)
      })
      .finally(() => setLoading(false))
  }, [songId, token])

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

  const addRole = () =>
    setForm((current) => ({
      ...current,
      roles: [...current.roles, { role: 'Featured Artist', name: '' }],
    }))

  const removeRole = (index) =>
    setForm((current) => ({
      ...current,
      roles: current.roles.filter((_, i) => i !== index),
    }))

  const updateRole = (index, key, value) =>
    setForm((current) => ({
      ...current,
      roles: current.roles.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)),
    }))

  const setAlbumPlacement = (index, key) => (event) =>
    setForm((current) => {
      const nextValue = key === 'albumId'
        ? event.target.value
        : event.target.value === '' ? '' : Number(event.target.value)

      setValidationErrors((currentErrors) => {
        if (!currentErrors?.albumPlacements?.[index]) return currentErrors
        return {
          ...currentErrors,
          albumPlacementsRoot: '',
          albumPlacements: currentErrors.albumPlacements.map((placementErrors, i) =>
            i === index ? { ...placementErrors, [key]: '' } : placementErrors
          ),
        }
      })

      return {
        ...current,
        albumPlacements: current.albumPlacements.map((placement, i) =>
          i === index ? { ...placement, [key]: nextValue } : placement
        ),
        ...(() => {
          if (current.releaseDate || visibilityTouched) return {}
          const nextPlacements = current.albumPlacements.map((placement, i) =>
            i === index ? { ...placement, [key]: nextValue } : placement
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
      return { ...current, albumPlacements: [...current.albumPlacements, createAlbumPlacement()] }
    })

  const removeAlbumPlacement = (index) =>
    setForm((current) => {
      setValidationErrors((currentErrors) => currentErrors
        ? {
            ...currentErrors,
            albumPlacementsRoot: '',
            albumPlacements: (currentErrors.albumPlacements ?? []).filter((_, i) => i !== index),
          }
        : currentErrors)
      return {
        ...current,
        albumPlacements: current.albumPlacements.filter((_, i) => i !== index),
        ...(() => {
          if (current.releaseDate || visibilityTouched) return {}
          const nextPlacements = current.albumPlacements.filter((_, i) => i !== index)
          const primaryAlbumReleaseDate = albumById[nextPlacements[0]?.albumId]?.releaseDate?.slice?.(0, 10) ?? ''
          return defaultVisibilityForReleaseDate(primaryAlbumReleaseDate)
        })(),
      }
    })

  const handleSave = async () => {
    const nextErrors = validateSongForm(form, songs ?? [], albumById)
    if (hasSongValidationErrors(nextErrors)) {
      setValidationErrors(nextErrors)
      if (hasAlbumErrors(nextErrors) && !hasSongInfoErrors(nextErrors)) setActiveTabIndex(2)
      return
    }
    setValidationErrors(null)

    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/admin/songs?id=${form.id}` : '/api/admin/songs'
    const payload = {
      ...form,
      slug: slugify(form.title),
      albumIds: form.albumPlacements.map((p) => p.albumId),
      discNumbers: form.albumPlacements.map((p) => Number(p.discNumber)),
      trackNumbers: form.albumPlacements.map((p) => Number(p.trackNumber)),
    }

    const response = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to save song.' }))
      window.alert(error.error ?? 'Failed to save song.')
      return
    }

    onSaved(await response.json())
  }

  const songFieldClassName = (fieldName) =>
    `admin-artists-page-input${validationErrors?.[fieldName] ? ' admin-artists-page-input-invalid' : ''}`

  const placementFieldClassName = (index, fieldName) =>
    `admin-artists-page-input${validationErrors?.albumPlacements?.[index]?.[fieldName] ? ' admin-artists-page-input-invalid' : ''}`

  return (
    <div className="admin-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">{form?.id ? 'Edit Song' : 'New Song'}</h2>
          <button type="button" onClick={onClose} className="admin-modal-close" aria-label="Close">
            <FaTimes aria-hidden="true" />
          </button>
        </div>
        <div className="admin-modal-body">
          {loading || !form ? (
            <div className="admin-modal-loading">Loading…</div>
          ) : (
            <TabView activeIndex={activeTabIndex} onTabChange={(e) => setActiveTabIndex(e.index)} className="page-tabview admin-song-editor-tabs">
              <TabPanel header="Song Info">
                <div className="admin-modal-grid">
                  <div className="admin-modal-field admin-modal-field-full">
                    <div className="admin-artists-page-name-field">
                      <button
                        type="button"
                        onClick={() => {
                          setVisibilityTouched(true)
                          setForm((current) => ({ ...current, isVisible: !current.isVisible, autoShowOnRelease: false }))
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
                    <label className="admin-modal-label">{iconLabel(<SiSoundcloud />, 'SoundCloud URL')}</label>
                    <input type="text" placeholder="SoundCloud URL" value={form.soundcloudUrl} onChange={set('soundcloudUrl')} className="admin-artists-page-input" />
                  </div>
                  <div className="admin-modal-field admin-modal-field-full">
                    <label className="admin-modal-label">{iconLabel(<SiSpotify />, 'Spotify URL')}</label>
                    <input type="text" placeholder="Spotify URL" value={form.spotifyUrl} onChange={set('spotifyUrl')} className="admin-artists-page-input" />
                  </div>
                  <div className="admin-modal-field admin-modal-field-full">
                    <label className="admin-modal-label">{iconLabel(<SiApplemusic />, 'Apple Music URL')}</label>
                    <input type="text" placeholder="Apple Music URL" value={form.appleMusicUrl} onChange={set('appleMusicUrl')} className="admin-artists-page-input" />
                  </div>
                  <div className="admin-modal-field admin-modal-field-full">
                    <label className="admin-modal-label">{iconLabel(<SiYoutube />, 'YouTube URL')}</label>
                    <input type="text" placeholder="YouTube URL" value={form.youtubeUrl} onChange={set('youtubeUrl')} className="admin-artists-page-input" />
                  </div>
                </div>
              </TabPanel>
              <TabPanel header="Roles">
                <div className="admin-song-roles-list">
                  {form.roles.map((entry, index) => (
                    <div key={index} className="admin-song-role-row">
                      <select value={entry.role} onChange={(e) => updateRole(index, 'role', e.target.value)} className="admin-artists-page-input">
                        {SONG_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                      <input
                        type="text"
                        placeholder="Name"
                        value={entry.name}
                        onChange={(e) => updateRole(index, 'name', e.target.value)}
                        className="admin-artists-page-input"
                      />
                      <button type="button" onClick={() => removeRole(index)} className="admin-artists-page-danger-btn" aria-label="Remove role">
                        <FaTimes aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addRole} className="admin-artists-page-ghost-btn admin-song-add-role-btn">
                  + Add Role
                </button>
              </TabPanel>
              <TabPanel header="Album Info">
                <div className="admin-song-album-cards">
                  {form.albumPlacements.map((placement, index) => (
                    <div key={`${index}-${placement.albumId || 'new'}`} className="admin-song-album-card">
                      <div className="admin-song-album-card-header">
                        <h3 className="admin-song-album-card-title">Album {index + 1}</h3>
                        {form.albumPlacements.length > 1 && (
                          <button type="button" onClick={() => removeAlbumPlacement(index)} className="admin-artists-page-danger-btn">Remove</button>
                        )}
                      </div>
                      <div className="admin-modal-grid admin-song-album-grid">
                        <div className="admin-modal-field admin-modal-field-full">
                          <label className="admin-modal-label">Album <span className="admin-modal-label-required">*</span></label>
                          <select value={placement.albumId} onChange={setAlbumPlacement(index, 'albumId')} className={placementFieldClassName(index, 'albumId')} aria-invalid={Boolean(validationErrors?.albumPlacements?.[index]?.albumId)}>
                            <option value="">- Album -</option>
                            {sortedAlbums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
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
          )}
        </div>
        <div className="admin-modal-footer">
          <button type="button" onClick={onClose} className="admin-artists-page-ghost-btn">Cancel</button>
          {!isViewer && (
            <button type="button" onClick={handleSave} disabled={loading || !form} className="admin-artists-page-primary-btn">Save</button>
          )}
        </div>
      </div>
    </div>
  )
}
