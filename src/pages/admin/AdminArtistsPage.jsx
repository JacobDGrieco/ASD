import { useEffect, useState } from 'react'
import { FaApple, FaCheck, FaExternalLinkAlt, FaPencilAlt, FaSoundcloud, FaSpotify, FaTimes, FaTrash } from 'react-icons/fa'
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
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
}

const columns = [
  { key: 'images', label: 'Images', kind: 'images', className: 'admin-artists-page-col-image' },
  { key: 'name', label: 'Name', placeholder: 'Name', className: 'admin-artists-page-col-lg' },
  { key: 'slug', label: 'Slug', placeholder: 'Slug', className: 'admin-artists-page-col-lg' },
  { key: 'bio', label: 'Bio', placeholder: 'Bio', kind: 'textarea', className: 'admin-artists-page-col-xxl', valueClassName: 'admin-artists-page-wrap-value' },
  { key: 'aboutMe', label: 'About Me', placeholder: 'About Me', kind: 'textarea', className: 'admin-artists-page-col-xxl', valueClassName: 'admin-artists-page-wrap-value' },
  { key: 'soundcloudProfile', label: <FaSoundcloud />, headerLabel: 'SoundCloud', placeholder: 'SoundCloud URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell admin-artists-page-sticky-right-4` },
  { key: 'spotifyProfile', label: <FaSpotify />, headerLabel: 'Spotify', placeholder: 'Spotify URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell admin-artists-page-sticky-right-3` },
  { key: 'appleMusicProfile', label: <FaApple />, headerLabel: 'Apple Music', placeholder: 'Apple Music URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell admin-artists-page-sticky-right-2` },
]

function primaryImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null
  return images.find((image) => image.isPrimary) ?? images[0]
}

export default function AdminArtistsPage() {
  const { token } = useAdminAuth()
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
  const openEdit = (artist) => setForm({ ...artist, images: artist.images ?? [] })
  const closeForm = () => setForm(null)
  const isEditing = (artistId) => form && form.id === artistId
  const isCreating = Boolean(form && !form.id)
  const nextOrder = artists.reduce((maxOrder, artist) => Math.max(maxOrder, artist.order ?? 0), -1) + 1

  const handleSave = async () => {
    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/admin/artists?id=${form.id}` : '/api/admin/artists'
    const payload = isEdit ? form : { ...form, order: nextOrder }
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
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

  const renderField = (column) => {
    if (column.kind === 'images') {
      return (
        <ImageCollectionField
          value={form.images}
          onChange={(images) => setForm((current) => ({ ...current, images }))}
          token={token}
          folder="artists"
          entityLabel={form.name || 'Artist image'}
        />
      )
    }

    if (column.kind === 'textarea') {
      return (
        <textarea
          placeholder={column.placeholder}
          value={form[column.key] ?? ''}
          onChange={(event) => setForm((current) => ({ ...current, [column.key]: event.target.value }))}
          className={`admin-artists-page-input admin-artists-page-textarea-cell`}
          rows={3}
        />
      )
    }

    return (
      <input
        type={column.type ?? 'text'}
        placeholder={column.placeholder}
        value={form[column.key] ?? ''}
        onChange={(event) => setForm((current) => ({ ...current, [column.key]: event.target.value }))}
        className="admin-artists-page-input"
      />
    )
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

  const renderEditableRow = () => (
    <tr className="admin-artists-page-editing-row">
      <td className="admin-artists-page-drag-cell"></td>
      {columns.map((column) => (
        <td key={column.key} className={column.className}>
          {renderField(column)}
        </td>
      ))}
      <td className={`admin-artists-page-action-cell admin-artists-page-sticky-right-1`}>
        <button type="button" onClick={handleSave} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} aria-label="Save artist" title="Save">
          <FaCheck aria-hidden="true" />
        </button>
      </td>
      <td className={`admin-artists-page-action-cell admin-artists-page-sticky-right-0`}>
        <button type="button" onClick={closeForm} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} aria-label="Cancel artist edit" title="Cancel">
          <FaTimes aria-hidden="true" />
        </button>
      </td>
    </tr>
  )

  return (
    <div>
      <div className="admin-artists-page-header">
        <h1 className="admin-artists-page-title">Artists</h1>
        <button onClick={openCreate} className="admin-artists-page-primary-btn">New Artist</button>
      </div>

      <div className="admin-artists-page-table-wrap">
        <table className="admin-artists-page-table">
          <thead>
            <tr>
              <th className="admin-artists-page-drag-header"></th>
              {columns.map((column) => <th key={column.key} className={column.className}>{renderHeader(column)}</th>)}
              <th className={`admin-artists-page-col-action admin-artists-page-sticky-right-1`}></th>
              <th className={`admin-artists-page-col-action admin-artists-page-sticky-right-0`}></th>
            </tr>
          </thead>
          <tbody>
            {isCreating && renderEditableRow()}
            {artists.map((artist) => (
              isEditing(artist.id) ? (
                <tr key={artist.id} className="admin-artists-page-editing-row">
                  <td className="admin-artists-page-drag-cell"></td>
                  {columns.map((column) => (
                    <td key={column.key} className={column.className}>
                      {renderField(column)}
                    </td>
                  ))}
                  <td className={`admin-artists-page-action-cell admin-artists-page-sticky-right-1`}>
                    <button type="button" onClick={handleSave} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} aria-label="Save artist" title="Save">
                      <FaCheck aria-hidden="true" />
                    </button>
                  </td>
                  <td className={`admin-artists-page-action-cell admin-artists-page-sticky-right-0`}>
                    <button type="button" onClick={closeForm} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} aria-label="Cancel artist edit" title="Cancel">
                      <FaTimes aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr
                  key={artist.id}
                  className={dropTargetId === artist.id ? 'admin-artists-page-drop-target-row' : ''}
                  onDragOver={(event) => handleDragOver(event, artist.id)}
                  onDrop={(event) => {
                    event.preventDefault()
                    handleDrop(artist.id)
                  }}
                >
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
                  {columns.map((column) => (
                    <td key={column.key} className={`${column.className ?? ''} ${column.key === 'slug' ? 'admin-artists-page-muted' : ''}`.trim()}>
                      {renderDisplayValue(artist, column)}
                    </td>
                  ))}
                  <td className={`admin-artists-page-action-cell admin-artists-page-sticky-right-1`}>
                    <button type="button" onClick={() => openEdit(artist)} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} aria-label="Edit artist" title="Edit">
                      <FaPencilAlt aria-hidden="true" />
                    </button>
                  </td>
                  <td className={`admin-artists-page-action-cell admin-artists-page-sticky-right-0`}>
                    <button type="button" onClick={() => handleDelete(artist.id)} className={`admin-artists-page-danger-btn admin-artists-page-icon-btn`} aria-label="Delete artist" title="Delete">
                      <FaTrash aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
