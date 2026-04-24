import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import styles from './AdminArtistsPage.module.css'

const empty = {
  title: '', slug: '', trackNumber: 1, discNumber: 1, duration: '',
  soundcloudUrl: '', spotifyUrl: '', appleMusicUrl: '', albumId: '',
  aboutText: '', producers: '', writers: '',
}

export default function AdminSongsPage() {
  const { token } = useAdminAuth()
  const auth = { Authorization: `Bearer ${token}` }
  const [songs, setSongs] = useState([])
  const [albums, setAlbums] = useState([])
  const [form, setForm] = useState(null)

  useEffect(() => {
    fetch('/api/admin/songs', { headers: auth }).then((r) => r.json()).then(setSongs)
    fetch('/api/admin/albums', { headers: auth }).then((r) => r.json()).then(setAlbums)
  }, [token])

  const openCreate = () => setForm({ ...empty })
  const openEdit = (s) => setForm({ ...empty, ...s, ...s.meta })
  const closeForm = () => setForm(null)

  const handleSave = async (e) => {
    e.preventDefault()
    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/admin/songs?id=${form.id}` : '/api/admin/songs'
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const saved = await res.json()
    const album = albums.find((a) => a.id === saved.albumId)
    const withRelations = { ...saved, album: album ? { title: album.title, artist: album.artist } : null, meta: { aboutText: form.aboutText, producers: form.producers, writers: form.writers } }
    setSongs((prev) => isEdit ? prev.map((s) => s.id === saved.id ? withRelations : s) : [...prev, withRelations])
    closeForm()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this song and all its lyrics/annotations?')) return
    await fetch(`/api/admin/songs?id=${id}`, { method: 'DELETE', headers: auth })
    setSongs((prev) => prev.filter((s) => s.id !== id))
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setNum = (key) => (e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Songs</h1>
        <button onClick={openCreate} className={styles.primaryBtn}>New Song</button>
      </div>

      {form && (
        <form onSubmit={handleSave} className={styles.form}>
          <h2 className={styles.formTitle}>{form.id ? 'Edit Song' : 'New Song'}</h2>
          <div className={styles.fields}>
            <input placeholder="Title" value={form.title} onChange={set('title')} className={styles.input} />
            <input placeholder="Slug" value={form.slug} onChange={set('slug')} className={styles.input} />
            <input placeholder="Track #" type="number" value={form.trackNumber} onChange={setNum('trackNumber')} className={styles.input} />
            <input placeholder="Disc #" type="number" value={form.discNumber} onChange={setNum('discNumber')} className={styles.input} />
            <input placeholder="Duration (e.g. 3:42)" value={form.duration} onChange={set('duration')} className={styles.input} />
            <select value={form.albumId} onChange={set('albumId')} className={styles.input}>
              <option value="">— Album —</option>
              {albums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
            <input placeholder="SoundCloud URL" value={form.soundcloudUrl ?? ''} onChange={set('soundcloudUrl')} className={styles.input} />
            <input placeholder="Spotify URL" value={form.spotifyUrl ?? ''} onChange={set('spotifyUrl')} className={styles.input} />
            <input placeholder="Apple Music URL" value={form.appleMusicUrl ?? ''} onChange={set('appleMusicUrl')} className={styles.input} />
            <input placeholder="Producers" value={form.producers} onChange={set('producers')} className={styles.input} />
            <input placeholder="Writers" value={form.writers} onChange={set('writers')} className={styles.input} />
            <textarea placeholder="About this song…" value={form.aboutText} onChange={set('aboutText')} className={styles.input} rows={3} style={{ resize: 'vertical' }} />
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryBtn}>Save</button>
            <button type="button" onClick={closeForm} className={styles.ghostBtn}>Cancel</button>
          </div>
        </form>
      )}

      <table className={styles.table}>
        <thead>
          <tr><th>#</th><th>Title</th><th>Album</th><th>Duration</th><th></th></tr>
        </thead>
        <tbody>
          {songs.map((s) => (
            <tr key={s.id}>
              <td className={styles.muted}>{s.discNumber}.{s.trackNumber}</td>
              <td>{s.title}</td>
              <td className={styles.muted}>{s.album?.title}</td>
              <td className={styles.muted}>{s.duration}</td>
              <td className={styles.actions}>
                <Link to={`/admin/lyrics/${s.id}`} state={{ songTitle: s.title }} className={styles.ghostBtn} style={{ textDecoration: 'none', display: 'inline-block' }}>Edit Lyrics</Link>
                <button onClick={() => openEdit(s)} className={styles.ghostBtn}>Edit</button>
                <button onClick={() => handleDelete(s.id)} className={styles.dangerBtn}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
