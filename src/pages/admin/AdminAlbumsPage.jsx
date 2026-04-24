import { useEffect, useState } from 'react'
import { FaApple, FaCheck, FaExternalLinkAlt, FaPencilAlt, FaSoundcloud, FaSpotify, FaTimes, FaTrash } from 'react-icons/fa'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import styles from '../../styles/AdminArtistsPage.module.css'

const empty = {
  title: '',
  slug: '',
  type: 'ALBUM',
  coverArt: '',
  aboutText: '',
  soundcloudUrl: '',
  spotifyUrl: '',
  appleMusicUrl: '',
  releaseDate: '',
  artistId: '',
}

const columns = [
  { key: 'coverArt', label: 'Cover Art', placeholder: 'Cover Art URL', kind: 'image', className: styles.colSm },
  { key: 'title', label: 'Title', placeholder: 'Title', className: styles.colXl },
  { key: 'artistId', label: 'Artist', kind: 'artist', className: styles.colSm },
  { key: 'slug', label: 'Slug', placeholder: 'Slug', className: styles.colMd },
  { key: 'type', label: 'Type', kind: 'select', className: styles.colSm },
  { key: 'releaseDate', label: 'Release Date', type: 'date', placeholder: 'Release Date', className: styles.colSm },
  { key: 'aboutText', label: 'About', placeholder: 'About this album...', kind: 'textarea', className: styles.colXxl, valueClassName: styles.wrapValue },
  { key: 'soundcloudUrl', label: 'SoundCloud', placeholder: 'SoundCloud URL', kind: 'link', className: `${styles.colAction} ${styles.centerCell}` },
  { key: 'spotifyUrl', label: 'Spotify', placeholder: 'Spotify URL', kind: 'link', className: `${styles.colAction} ${styles.centerCell}` },
  { key: 'appleMusicUrl', label: 'Apple Music', placeholder: 'Apple Music URL', kind: 'link', className: `${styles.colAction} ${styles.centerCell}` },
]

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
    setAlbums((prev) => isEdit ? prev.map((album) => album.id === saved.id ? withArtist : album) : [...prev, withArtist])
    closeForm()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this album and all its songs?')) return
    await fetch(`/api/admin/albums?id=${id}`, { method: 'DELETE', headers: auth })
    setAlbums((prev) => prev.filter((album) => album.id !== id))
  }

  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }))

  const renderField = (column) => {
    if (column.kind === 'select') {
      return (
        <select value={form.type} onChange={set('type')} className={styles.input}>
          <option value="ALBUM">Album</option>
          <option value="SINGLE">Single</option>
          <option value="EP">EP</option>
        </select>
      )
    }

    if (column.kind === 'artist') {
      return (
        <select value={form.artistId} onChange={set('artistId')} className={styles.input}>
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
          className={`${styles.input} ${styles.textareaCell}`}
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
          className={styles.input}
        />
      )
    }

    return (
      <input
        type={column.type ?? 'text'}
        placeholder={column.placeholder}
        value={form[column.key] ?? ''}
        onChange={set(column.key)}
        className={styles.input}
      />
    )
  }

  const renderValue = (album, column) => {
    if (column.key === 'artistId') {
      return album.artist?.name ? <span className={styles.cellValue} title={album.artist.name}>{album.artist.name}</span> : <span className={styles.emptyValue}>-</span>
    }

    if (column.key === 'releaseDate') {
      const value = album.releaseDate ? album.releaseDate.slice(0, 10) : ''
      return value ? <span className={styles.cellValue} title={value}>{value}</span> : <span className={styles.emptyValue}>-</span>
    }

    if (column.kind === 'link') {
      const value = album[column.key]
      return value
        ? (
          <a
            href={String(value)}
            target="_blank"
            rel="noreferrer"
            className={styles.linkBtn}
            aria-label={`Open ${column.label} in new tab`}
            title="Open in new tab"
          >
            <FaExternalLinkAlt aria-hidden="true" />
          </a>
        )
        : <span className={styles.emptyValue}>-</span>
    }

    if (column.kind === 'image') {
      const value = album[column.key]
      return value ? <img src={String(value)} alt={album.title} className={styles.thumb} /> : <span className={styles.emptyValue}>-</span>
    }

    const value = album[column.key]
    if (value === null || value === undefined || value === '') return <span className={styles.emptyValue}>-</span>
    return <span className={column.valueClassName ?? styles.cellValue} title={String(value)}>{String(value)}</span>
  }

  const renderHeader = (column) => {
    if (column.key === 'soundcloudUrl') return <span className={styles.socialHeader} aria-label="SoundCloud"><FaSoundcloud aria-hidden="true" /></span>
    if (column.key === 'spotifyUrl') return <span className={styles.socialHeader} aria-label="Spotify"><FaSpotify aria-hidden="true" /></span>
    if (column.key === 'appleMusicUrl') return <span className={styles.socialHeader} aria-label="Apple Music"><FaApple aria-hidden="true" /></span>
    return column.label
  }

  const renderEditableRow = (key) => (
    <tr key={key} className={styles.editingRow}>
      {columns.map((column) => (
        <td key={column.key} className={column.className}>
          {renderField(column)}
        </td>
      ))}
      <td className={styles.actionCell}>
        <button type="button" onClick={handleSave} className={`${styles.ghostBtn} ${styles.iconBtn}`} aria-label="Save album" title="Save">
          <FaCheck aria-hidden="true" />
        </button>
      </td>
      <td className={styles.actionCell}>
        <button type="button" onClick={closeForm} className={`${styles.ghostBtn} ${styles.iconBtn}`} aria-label="Cancel album edit" title="Cancel">
          <FaTimes aria-hidden="true" />
        </button>
      </td>
    </tr>
  )

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Albums</h1>
        <button onClick={openCreate} className={styles.primaryBtn}>New Album</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((column) => <th key={column.key} className={column.className}>{renderHeader(column)}</th>)}
              <th className={styles.colAction}></th>
              <th className={styles.colAction}></th>
            </tr>
          </thead>
          <tbody>
            {isCreating && renderEditableRow('create')}
            {albums.map((album) => (
              isEditing(album.id) ? renderEditableRow(album.id) : (
                <tr key={album.id}>
                  {columns.map((column) => (
                    <td key={column.key} className={`${column.className ?? ''} ${column.key === 'slug' || column.key === 'type' ? styles.muted : ''}`.trim()}>
                      {renderValue(album, column)}
                    </td>
                  ))}
                  <td className={styles.actionCell}>
                    <button type="button" onClick={() => openEdit(album)} className={`${styles.ghostBtn} ${styles.iconBtn}`} aria-label="Edit album" title="Edit">
                      <FaPencilAlt aria-hidden="true" />
                    </button>
                  </td>
                  <td className={styles.actionCell}>
                    <button type="button" onClick={() => handleDelete(album.id)} className={`${styles.dangerBtn} ${styles.iconBtn}`} aria-label="Delete album" title="Delete">
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
