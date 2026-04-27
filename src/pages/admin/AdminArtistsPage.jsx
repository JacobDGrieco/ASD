import { useEffect, useState } from 'react'
import { FaApple, FaExternalLinkAlt, FaPencilAlt, FaSoundcloud, FaSpotify, FaTrash, FaYoutube } from 'react-icons/fa'
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import { slugify } from '../../lib/slugify.js'
import '../../styles/AdminArtistsPage.css'

const empty = {
  name: '',
  slug: '',
  bio: '',
  aboutMe: '',
  images: [],
  order: 0,
  soundcloudProfile: '',
  spotifyProfile: '',
  appleMusicProfile: '',
  youtubeProfile: '',
}

const columns = [
  { key: 'images', label: 'Images', kind: 'images', className: 'admin-artists-page-col-image' },
  { key: 'name', label: 'Name', placeholder: 'Name', className: 'admin-artists-page-col-lg' },
  { key: 'bio', label: 'Bio', placeholder: 'Bio', kind: 'textarea', className: 'admin-artists-page-col-xxl', valueClassName: 'admin-artists-page-wrap-value' },
  { key: 'aboutMe', label: 'About Me', placeholder: 'About Me', kind: 'textarea', className: 'admin-artists-page-col-xxl', valueClassName: 'admin-artists-page-wrap-value' },
  { key: 'soundcloudProfile', label: <FaSoundcloud />, headerLabel: 'SoundCloud', placeholder: 'SoundCloud URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
  { key: 'spotifyProfile', label: <FaSpotify />, headerLabel: 'Spotify', placeholder: 'Spotify URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
  { key: 'appleMusicProfile', label: <FaApple />, headerLabel: 'Apple Music', placeholder: 'Apple Music URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
  { key: 'youtubeProfile', label: <FaYoutube />, headerLabel: 'YouTube', placeholder: 'YouTube URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
]

function primaryImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null
  return images.find((image) => image.isPrimary) ?? images[0]
}

function validateArtistForm(form) {
  if (!form.name?.trim()) return 'Artist name is required.'
  return null
}

export default function AdminArtistsPage() {
  const { token, session } = useAdminAuth()
  const isSuperAdmin = session?.role !== 'ARTIST'
  const auth = { Authorization: `Bearer ${token}` }
  const [artists, setArtists] = useState([])
  const [form, setForm] = useState(null)
  const [draggedArtistId, setDraggedArtistId] = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)

  useEffect(() => {
    fetch('/api/admin/artists', { headers: auth })
      .then((r) => r.json())
      .then(setArtists)
  }, [token])

  const openCreate = () => setForm({ ...empty })
  const openEdit = (artist) => setForm({ ...empty, ...artist, images: artist.images ?? [] })
  const closeForm = () => setForm(null)
  const nextOrder = artists.reduce((maxOrder, artist) => Math.max(maxOrder, artist.order ?? 0), -1) + 1

  const handleSave = async () => {
    const validationError = validateArtistForm(form)
    if (validationError) {
      window.alert(validationError)
      return
    }

    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/admin/artists?id=${form.id}` : '/api/admin/artists'
    const payload = {
      ...form,
      slug: slugify(form.name),
      ...(isEdit ? {} : { order: nextOrder }),
    }
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to save artist.' }))
      window.alert(error.error ?? 'Failed to save artist.')
      return
    }
    const saved = await res.json()
    setArtists((prev) => (isEdit ? prev.map((artist) => (artist.id === saved.id ? saved : artist)) : [...prev, saved]))
    closeForm()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this artist and all their albums/songs?')) return
    await fetch(`/api/admin/artists?id=${id}`, { method: 'DELETE', headers: auth })
    setArtists((prev) => prev.filter((artist) => artist.id !== id))
  }

  const persistArtistOrder = async (nextArtists) => {
    const changedArtists = nextArtists.filter((artist, index) => artist.order !== index)
    if (!changedArtists.length) return nextArtists

    const savedArtists = await Promise.all(
      changedArtists.map((artist) => {
        const nextOrderValue = nextArtists.findIndex((candidate) => candidate.id === artist.id)
        return fetch(`/api/admin/artists?id=${artist.id}`, {
          method: 'PUT',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...artist, order: nextOrderValue }),
        }).then((res) => res.json())
      })
    )

    const savedById = new Map(savedArtists.map((artist) => [artist.id, artist]))
    return nextArtists.map((artist, index) => savedById.get(artist.id) ?? { ...artist, order: index })
  }

  const handleDragStart = (event, artistId) => {
    if (form) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', artistId)
    setDraggedArtistId(artistId)
  }

  const handleDragOver = (event, artistId) => {
    if (!draggedArtistId || draggedArtistId === artistId) return
    event.preventDefault()
    setDropTargetId(artistId)
  }

  const handleDrop = async (artistId) => {
    if (!draggedArtistId || draggedArtistId === artistId) {
      setDraggedArtistId(null)
      setDropTargetId(null)
      return
    }

    const draggedIndex = artists.findIndex((artist) => artist.id === draggedArtistId)
    const targetIndex = artists.findIndex((artist) => artist.id === artistId)
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedArtistId(null)
      setDropTargetId(null)
      return
    }

    const reordered = [...artists]
    const [movedArtist] = reordered.splice(draggedIndex, 1)
    reordered.splice(targetIndex, 0, movedArtist)

    const normalized = reordered.map((artist, index) => ({ ...artist, order: index }))
    setArtists(normalized)
    setDraggedArtistId(null)
    setDropTargetId(null)

    const persisted = await persistArtistOrder(reordered)
    setArtists(persisted)
  }

  const handleDragEnd = () => {
    setDraggedArtistId(null)
    setDropTargetId(null)
  }

  const renderDisplayValue = (artist, column) => {
    const value = artist[column.key]
    if (column.kind === 'images') {
      const image = primaryImage(artist.images)
      if (!image) return <span className="admin-artists-page-empty-value">-</span>
      return (
        <div className="admin-artists-page-image-summary">
          <img src={image.previewUrl || image.url} alt={artist.name} className="admin-artists-page-thumb" />
          <span className="admin-artists-page-image-count">{artist.images?.length ?? 1} image{(artist.images?.length ?? 1) === 1 ? '' : 's'}</span>
        </div>
      )
    }
    if (value === null || value === undefined || value === '') return <span className="admin-artists-page-empty-value">-</span>
    if (column.kind === 'link') {
      return (
        <a href={String(value)} target="_blank" rel="noreferrer" className="admin-artists-page-link-btn" aria-label={`Open ${column.headerLabel} link`} title="Open in new tab">
          <FaExternalLinkAlt aria-hidden="true" />
        </a>
      )
    }
    return (
      <span className={column.valueClassName ?? 'admin-artists-page-cell-value'} title={String(value)}>
        {String(value)}
      </span>
    )
  }

  const renderHeader = (column) => {
    if (column.kind !== 'link') return column.label
    return (
      <span className="admin-artists-page-social-header" title={column.headerLabel}>
        <span aria-hidden="true">{column.label}</span>
        <span className="admin-artists-page-sr-only">{column.headerLabel}</span>
      </span>
    )
  }

  return (
    <div>
      <div className="admin-artists-page-header">
        <h1 className="admin-artists-page-title">Artists</h1>
        {isSuperAdmin && <button onClick={openCreate} className="admin-artists-page-primary-btn">New Artist</button>}
      </div>

      <div className="admin-artists-page-table-wrap">
        <table className="admin-artists-page-table">
          <thead>
            <tr>
              {isSuperAdmin && <th className="admin-artists-page-drag-header"></th>}
              {columns.map((column) => <th key={column.key} className={column.className}>{renderHeader(column)}</th>)}
              <th className={`admin-artists-page-col-action admin-artists-page-sticky-right-1`}></th>
              {isSuperAdmin && <th className={`admin-artists-page-col-action admin-artists-page-sticky-right-0`}></th>}
            </tr>
          </thead>
          <tbody>
            {artists.map((artist) => (
              <tr
                key={artist.id}
                className={dropTargetId === artist.id ? 'admin-artists-page-drop-target-row' : ''}
                onDragOver={(event) => handleDragOver(event, artist.id)}
                onDrop={(event) => {
                  event.preventDefault()
                  handleDrop(artist.id)
                }}
              >
                {isSuperAdmin && (
                  <td className="admin-artists-page-drag-cell">
                    <button
                      type="button"
                      draggable={!form}
                      onDragStart={(event) => handleDragStart(event, artist.id)}
                      onDragEnd={handleDragEnd}
                      className="admin-artists-page-drag-handle"
                      aria-label={`Reorder ${artist.name}`}
                      title="Drag to reorder"
                    >
                      ::
                    </button>
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key} className={column.className ?? ''}>
                    {renderDisplayValue(artist, column)}
                  </td>
                ))}
                <td className={`admin-artists-page-action-cell admin-artists-page-sticky-right-1`}>
                  <button type="button" onClick={() => openEdit(artist)} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} aria-label="Edit artist" title="Edit">
                    <FaPencilAlt aria-hidden="true" />
                  </button>
                </td>
                {isSuperAdmin && (
                  <td className={`admin-artists-page-action-cell admin-artists-page-sticky-right-0`}>
                    <button type="button" onClick={() => handleDelete(artist.id)} className={`admin-artists-page-danger-btn admin-artists-page-icon-btn`} aria-label="Delete artist" title="Delete">
                      <FaTrash aria-hidden="true" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="admin-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{form.id ? 'Edit Artist' : 'New Artist'}</h2>
              <button type="button" onClick={closeForm} className="admin-modal-close" aria-label="Close">×</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-modal-grid">
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Name</label>
                  <input
                    type="text"
                    placeholder="Name"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value, slug: slugify(event.target.value) }))}
                    className="admin-artists-page-input"
                  />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Images</label>
                  <ImageCollectionField
                    value={form.images}
                    onChange={(images) => setForm((current) => ({ ...current, images }))}
                    token={token}
                    folder="artists"
                    entityLabel={form.name || 'Artist image'}
                  />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Bio</label>
                  <textarea
                    placeholder="Bio"
                    value={form.bio}
                    onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                    className="admin-artists-page-input admin-modal-textarea"
                    rows={5}
                  />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">About Me</label>
                  <textarea
                    placeholder="About Me"
                    value={form.aboutMe}
                    onChange={(event) => setForm((current) => ({ ...current, aboutMe: event.target.value }))}
                    className="admin-artists-page-input admin-modal-textarea"
                    rows={5}
                  />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">SoundCloud URL</label>
                  <input type="url" placeholder="SoundCloud URL" value={form.soundcloudProfile} onChange={(event) => setForm((current) => ({ ...current, soundcloudProfile: event.target.value }))} className="admin-artists-page-input" />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Spotify URL</label>
                  <input type="url" placeholder="Spotify URL" value={form.spotifyProfile} onChange={(event) => setForm((current) => ({ ...current, spotifyProfile: event.target.value }))} className="admin-artists-page-input" />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Apple Music URL</label>
                  <input type="url" placeholder="Apple Music URL" value={form.appleMusicProfile} onChange={(event) => setForm((current) => ({ ...current, appleMusicProfile: event.target.value }))} className="admin-artists-page-input" />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">YouTube URL</label>
                  <input type="url" placeholder="YouTube URL" value={form.youtubeProfile} onChange={(event) => setForm((current) => ({ ...current, youtubeProfile: event.target.value }))} className="admin-artists-page-input" />
                </div>
              </div>
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
