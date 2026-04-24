import { useState, useEffect } from 'react'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import styles from './AdminArtistsPage.module.css'

const empty = { name: '', slug: '', bio: '', aboutMe: '', portrait: '', order: 0, soundcloudProfile: '', spotifyProfile: '', appleMusicProfile: '' }

export default function AdminArtistsPage() {
  const { token } = useAdminAuth()
  const auth = { Authorization: `Bearer ${token}` }
  const [artists, setArtists] = useState([])
  const [form, setForm] = useState(null)

  useEffect(() => {
    fetch('/api/admin/artists', { headers: auth })
      .then((r) => r.json())
      .then(setArtists)
  }, [token])

  const openCreate = () => setForm({ ...empty })
  const openEdit = (a) => setForm({ ...a })
  const closeForm = () => setForm(null)

  const handleSave = async (e) => {
    e.preventDefault()
    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/admin/artists?id=${form.id}` : '/api/admin/artists'
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const saved = await res.json()
    setArtists((prev) => isEdit ? prev.map((a) => a.id === saved.id ? saved : a) : [...prev, saved])
    closeForm()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this artist and all their albums/songs?')) return
    await fetch(`/api/admin/artists?id=${id}`, { method: 'DELETE', headers: auth })
    setArtists((prev) => prev.filter((a) => a.id !== id))
  }

  const field = (key, placeholder, type = 'text') => (
    <input
      key={key}
      type={type}
      placeholder={placeholder}
      value={form[key] ?? ''}
      onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
      className={styles.input}
    />
  )

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Artists</h1>
        <button onClick={openCreate} className={styles.primaryBtn}>New Artist</button>
      </div>

      {form && (
        <form onSubmit={handleSave} className={styles.form}>
          <h2 className={styles.formTitle}>{form.id ? 'Edit Artist' : 'New Artist'}</h2>
          <div className={styles.fields}>
            {field('name', 'Name')}
            {field('slug', 'Slug')}
            {field('bio', 'Bio')}
            {field('aboutMe', 'About Me')}
            {field('portrait', 'Portrait URL')}
            {field('order', 'Order', 'number')}
            {field('soundcloudProfile', 'SoundCloud Profile URL')}
            {field('spotifyProfile', 'Spotify Profile URL')}
            {field('appleMusicProfile', 'Apple Music Profile URL')}
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryBtn}>Save</button>
            <button type="button" onClick={closeForm} className={styles.ghostBtn}>Cancel</button>
          </div>
        </form>
      )}

      <table className={styles.table}>
        <thead>
          <tr><th>Order</th><th>Name</th><th>Slug</th><th></th></tr>
        </thead>
        <tbody>
          {artists.map((a) => (
            <tr key={a.id}>
              <td>{a.order}</td>
              <td>{a.name}</td>
              <td className={styles.muted}>{a.slug}</td>
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
