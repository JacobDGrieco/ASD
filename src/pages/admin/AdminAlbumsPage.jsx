import { useState, useEffect } from 'react'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import styles from './AdminArtistsPage.module.css'

const empty = { title: '', slug: '', type: 'ALBUM', coverArt: '', releaseDate: '', artistId: '' }

export default function AdminAlbumsPage() {
  const { token } = useAdminAuth()
  const auth = { Authorization: `Bearer ${token}` }
  const [albums, setAlbums] = useState([])
  const [artists, setArtists] = useState([])
  const [form, setForm] = useState(null)

  useEffect(() => {
    fetch('/api/admin/albums', { headers: auth }).then((r) => r.json()).then(setAlbums)
    fetch('/api/admin/artists', { headers: auth }).then((r) => r.json()).then(setArtists)
  }, [token])

  const openCreate = () => setForm({ ...empty })
  const openEdit = (a) => setForm({ ...a, releaseDate: a.releaseDate ? a.releaseDate.slice(0, 10) : '' })
  const closeForm = () => setForm(null)

  const handleSave = async (e) => {
    e.preventDefault()
    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/admin/albums?id=${form.id}` : '/api/admin/albums'
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const saved = await res.json()
    const withArtist = { ...saved, artist: artists.find((a) => a.id === saved.artistId) ?? null }
    setAlbums((prev) => isEdit ? prev.map((a) => a.id === saved.id ? withArtist : a) : [...prev, withArtist])
    closeForm()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this album and all its songs?')) return
    await fetch(`/api/admin/albums?id=${id}`, { method: 'DELETE', headers: auth })
    setAlbums((prev) => prev.filter((a) => a.id !== id))
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Albums</h1>
        <button onClick={openCreate} className={styles.primaryBtn}>New Album</button>
      </div>

      {form && (
        <form onSubmit={handleSave} className={styles.form}>
          <h2 className={styles.formTitle}>{form.id ? 'Edit Album' : 'New Album'}</h2>
          <div className={styles.fields}>
            <input placeholder="Title" value={form.title} onChange={set('title')} className={styles.input} />
            <input placeholder="Slug" value={form.slug} onChange={set('slug')} className={styles.input} />
            <select value={form.type} onChange={set('type')} className={styles.input}>
              <option value="ALBUM">Album</option>
              <option value="SINGLE">Single</option>
              <option value="EP">EP</option>
            </select>
            <input placeholder="Cover Art URL" value={form.coverArt} onChange={set('coverArt')} className={styles.input} />
            <input type="date" value={form.releaseDate} onChange={set('releaseDate')} className={styles.input} />
            <select value={form.artistId} onChange={set('artistId')} className={styles.input}>
              <option value="">— Artist —</option>
              {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryBtn}>Save</button>
            <button type="button" onClick={closeForm} className={styles.ghostBtn}>Cancel</button>
          </div>
        </form>
      )}

      <table className={styles.table}>
        <thead>
          <tr><th>Title</th><th>Type</th><th>Artist</th><th>Release</th><th></th></tr>
        </thead>
        <tbody>
          {albums.map((a) => (
            <tr key={a.id}>
              <td>{a.title}</td>
              <td className={styles.muted}>{a.type}</td>
              <td className={styles.muted}>{a.artist?.name}</td>
              <td className={styles.muted}>{a.releaseDate?.slice(0, 10)}</td>
              <td className={styles.actions}>
                <button onClick={() => openEdit(a)} className={styles.ghostBtn}>Edit</button>
                <button onClick={() => handleDelete(a.id)} className={styles.dangerBtn}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
