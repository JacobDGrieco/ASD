import { useEffect, useState } from 'react'
import { FaApple, FaCheck, FaExternalLinkAlt, FaPencilAlt, FaSoundcloud, FaSpotify, FaTimes, FaTrash } from 'react-icons/fa'
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import '../../styles/AdminArtistsPage.css'

const empty = {
  title: '',
  slug: '',
  type: 'ALBUM',
  images: [],
  aboutText: '',
  soundcloudUrl: '',
  spotifyUrl: '',
  appleMusicUrl: '',
  releaseDate: '',
  artistId: '',
}

const columns = [
  { key: 'images', label: 'Images', kind: 'images', className: 'admin-artists-page-col-image' },
  { key: 'title', label: 'Title', placeholder: 'Title', className: 'admin-artists-page-col-wide' },
  { key: 'artistId', label: 'Artist', kind: 'artist', className: 'admin-artists-page-col-sm' },
  { key: 'slug', label: 'Slug', placeholder: 'Slug', className: 'admin-artists-page-col-lg' },
  { key: 'type', label: 'Type', kind: 'select', className: 'admin-artists-page-col-sm' },
  { key: 'releaseDate', label: 'Release Date', type: 'date', placeholder: 'Release Date', className: 'admin-artists-page-col-sm' },
  { key: 'aboutText', label: 'About', placeholder: 'About this album...', kind: 'textarea', className: 'admin-artists-page-col-xxl', valueClassName: 'admin-artists-page-wrap-value' },
  { key: 'soundcloudUrl', label: 'SoundCloud', placeholder: 'SoundCloud URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
  { key: 'spotifyUrl', label: 'Spotify', placeholder: 'Spotify URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
  { key: 'appleMusicUrl', label: 'Apple Music', placeholder: 'Apple Music URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
]

function primaryImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null
  return images.find((image) => image.isPrimary) ?? images[0]
}

export default function AdminAlbumsPage() {
  const { token } = useAdminAuth()
  const auth = { Authorization: `Bearer ${token}` }
  const [albums, setAlbums] = useState([])
  const [artists, setArtists] = useState([])
  const [form, setForm] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/albums', { headers: auth }).then((r) => r.json()),
      fetch('/api/admin/artists', { headers: auth }).then((r) => r.json()),
    ]).then(([albumList, artistList]) => {
      const artistOrder = new Map(artistList.map((artist) => [artist.id, artist.order ?? 0]))
      const sortedAlbums = [...albumList].sort((left, right) => {
        const artistDiff = (artistOrder.get(left.artistId) ?? 0) - (artistOrder.get(right.artistId) ?? 0)
        if (artistDiff !== 0) return artistDiff
        return new Date(right.releaseDate).getTime() - new Date(left.releaseDate).getTime()
      })
      setArtists(artistList)
      setAlbums(sortedAlbums)
    })
  }, [token])

  const openCreate = () => setForm({ ...empty })
  const openEdit = (album) => setForm({
    ...album,
    images: album.images ?? [],
    aboutText: album.aboutText ?? '',
    soundcloudUrl: album.soundcloudUrl ?? '',
    spotifyUrl: album.spotifyUrl ?? '',
    appleMusicUrl: album.appleMusicUrl ?? '',
    releaseDate: album.releaseDate ? album.releaseDate.slice(0, 10) : '',
  })
  const closeForm = () => setForm(null)
  const isEditing = (albumId) => form && form.id === albumId
  const isCreating = Boolean(form && !form.id)

  const handleSave = async () => {
    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/admin/albums?id=${form.id}` : '/api/admin/albums'
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const saved = await res.json()
    const withArtist = { ...saved, artist: artists.find((artist) => artist.id === saved.artistId) ?? null }
    setAlbums((prev) => (isEdit ? prev.map((album) => (album.id === saved.id ? withArtist : album)) : [...prev, withArtist]))
    closeForm()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this album and all its songs?')) return
    await fetch(`/api/admin/albums?id=${id}`, { method: 'DELETE', headers: auth })
    setAlbums((prev) => prev.filter((album) => album.id !== id))
  }

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const renderField = (column) => {
    if (column.kind === 'images') {
      return (
        <ImageCollectionField
          value={form.images}
          onChange={(images) => setForm((current) => ({ ...current, images }))}
          token={token}
          folder="albums"
          entityLabel={form.title || 'Album image'}
        />
      )
    }

    if (column.kind === 'select') {
      return (
        <select value={form.type} onChange={set('type')} className="admin-artists-page-input">
          <option value="ALBUM">Album</option>
          <option value="SINGLE">Single</option>
          <option value="EP">EP</option>
        </select>
      )
    }

    if (column.kind === 'artist') {
      return (
        <select value={form.artistId} onChange={set('artistId')} className="admin-artists-page-input">
          <option value="">- Artist -</option>
          {artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
        </select>
      )
    }

    if (column.kind === 'textarea') {
      return (
        <textarea
          placeholder={column.placeholder}
          value={form.aboutText ?? ''}
          onChange={set('aboutText')}
          className={`admin-artists-page-input admin-artists-page-textarea-cell`}
          rows={3}
        />
      )
    }

    if (column.kind === 'link') {
      return (
        <input
          type="url"
          placeholder={column.placeholder}
          value={form[column.key] ?? ''}
          onChange={set(column.key)}
          className="admin-artists-page-input"
        />
      )
    }

    return (
      <input
        type={column.type ?? 'text'}
        placeholder={column.placeholder}
        value={form[column.key] ?? ''}
        onChange={set(column.key)}
        className="admin-artists-page-input"
      />
    )
  }

  const renderValue = (album, column) => {
    if (column.key === 'artistId') {
      return album.artist?.name ? <span className="admin-artists-page-cell-value" title={album.artist.name}>{album.artist.name}</span> : <span className="admin-artists-page-empty-value">-</span>
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
          <img src={image.previewUrl || image.url} alt={album.title} className="admin-artists-page-thumb" />
          <span className="admin-artists-page-image-count">{album.images?.length ?? 1} image{(album.images?.length ?? 1) === 1 ? '' : 's'}</span>
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
    return column.label
  }

  const renderEditableRow = (key) => (
    <tr key={key} className="admin-artists-page-editing-row">
      {columns.map((column) => (
        <td key={column.key} className={column.className}>
          {renderField(column)}
        </td>
      ))}
      <td className="admin-artists-page-action-cell">
        <button type="button" onClick={handleSave} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} aria-label="Save album" title="Save">
          <FaCheck aria-hidden="true" />
        </button>
      </td>
      <td className="admin-artists-page-action-cell">
        <button type="button" onClick={closeForm} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} aria-label="Cancel album edit" title="Cancel">
          <FaTimes aria-hidden="true" />
        </button>
      </td>
    </tr>
  )

  return (
    <div>
      <div className="admin-artists-page-header">
        <h1 className="admin-artists-page-title">Albums</h1>
        <button onClick={openCreate} className="admin-artists-page-primary-btn">New Album</button>
      </div>

      <div className="admin-artists-page-table-wrap">
        <table className="admin-artists-page-table">
          <thead>
            <tr>
              {columns.map((column) => <th key={column.key} className={column.className}>{renderHeader(column)}</th>)}
              <th className="admin-artists-page-col-action"></th>
              <th className="admin-artists-page-col-action"></th>
            </tr>
          </thead>
          <tbody>
            {isCreating && renderEditableRow('create')}
            {albums.map((album) => (
              isEditing(album.id) ? renderEditableRow(album.id) : (
                <tr key={album.id}>
                  {columns.map((column) => (
                    <td key={column.key} className={`${column.className ?? ''} ${column.key === 'slug' || column.key === 'type' ? 'admin-artists-page-muted' : ''}`.trim()}>
                      {renderValue(album, column)}
                    </td>
                  ))}
                  <td className="admin-artists-page-action-cell">
                    <button type="button" onClick={() => openEdit(album)} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} aria-label="Edit album" title="Edit">
                      <FaPencilAlt aria-hidden="true" />
                    </button>
                  </td>
                  <td className="admin-artists-page-action-cell">
                    <button type="button" onClick={() => handleDelete(album.id)} className={`admin-artists-page-danger-btn admin-artists-page-icon-btn`} aria-label="Delete album" title="Delete">
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
