import { useState } from 'react'
import AlbumCard from './AlbumCard.jsx'
import TrackList from './TrackList.jsx'
import styles from './Discography.module.css'

export default function Discography({ albums }) {
  const [openId, setOpenId] = useState(null)

  function toggle(id) {
    setOpenId((prev) => (prev === id ? null : id))
  }

  const openAlbum = albums.find((a) => a.id === openId)

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Discography</h2>
      <div className={styles.grid}>
        {albums.map((album) => (
          <AlbumCard
            key={album.id}
            album={album}
            isOpen={openId === album.id}
            onClick={() => toggle(album.id)}
          />
        ))}
      </div>
      {openAlbum && (
        <div className={styles.expand}>
          <TrackList songs={openAlbum.songs} />
        </div>
      )}
    </section>
  )
}
