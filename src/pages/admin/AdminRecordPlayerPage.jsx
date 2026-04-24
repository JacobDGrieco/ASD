import { useEffect, useState } from 'react'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import '../../styles/AdminRecordPlayerPage.css'

const MAX_SLOTS = 8

function makeSlots(tracks) {
  const base = Array.from({ length: MAX_SLOTS }, (_, index) => ({
    position: index + 1,
    songId: '',
    active: true,
  }))

  tracks.forEach((track) => {
    if (track.position < 1 || track.position > MAX_SLOTS) return

    base[track.position - 1] = {
      position: track.position,
      songId: track.songId ?? track.song?.id ?? '',
      active: track.active ?? true,
    }
  })

  return base
}

export default function AdminRecordPlayerPage() {
  const { token } = useAdminAuth()
  const authHeaders = { Authorization: `Bearer ${token}` }

  const [slots, setSlots] = useState(() => makeSlots([]))
  const [songs, setSongs] = useState([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let ignore = false

    fetch('/api/admin/record-player', { headers: authHeaders })
      .then((response) => response.json())
      .then((tracks) => {
        if (!ignore) setSlots(makeSlots(tracks))
      })

    fetch('/api/admin/songs', { headers: authHeaders })
      .then((response) => response.json())
      .then((data) => {
        if (!ignore) setSongs(data)
      })

    return () => {
      ignore = true
    }
  }, [token])

  const updateSlot = (position, key, value) => {
    setSlots((current) =>
      current.map((slot) =>
        slot.position === position ? { ...slot, [key]: value } : slot
      )
    )
  }

  const handleSave = async () => {
    const filledSlots = slots.filter((slot) => slot.songId !== '')
    const response = await fetch('/api/admin/record-player', {
      method: 'PUT',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tracks: filledSlots }),
    })
    const updated = await response.json()
    setSlots(makeSlots(updated))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="admin-record-player-page-header">
        <h1 className="admin-record-player-page-title">Record Player</h1>
        <button type="button" onClick={handleSave} className="admin-record-player-page-primary-btn">
          Save Rack
        </button>
      </div>

      {saved ? <p className="admin-record-player-page-saved">Saved!</p> : null}

      <p className="admin-record-player-page-hint">
        Assign up to {MAX_SLOTS} songs to the home page vinyl rack.
      </p>

      <div className="admin-record-player-page-slots">
        {slots.map((slot) => (
          <div key={slot.position} className="admin-record-player-page-slot">
            <span className="admin-record-player-page-slot-label">Slot {slot.position}</span>

            <select
              value={slot.songId}
              onChange={(event) => updateSlot(slot.position, 'songId', event.target.value)}
              className="admin-record-player-page-select"
            >
              <option value="">- Empty -</option>
              {songs.map((song) => (
                <option key={song.id} value={song.id}>
                  {song.album?.artist?.name ? `${song.album.artist.name} - ` : ''}
                  {song.title}
                </option>
              ))}
            </select>

            <label className="admin-record-player-page-active-label">
              <input
                type="checkbox"
                checked={slot.active}
                onChange={(event) => updateSlot(slot.position, 'active', event.target.checked)}
                className="admin-record-player-page-checkbox"
              />
              Active
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}
