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
        {albums.map((album) => {
          const singleSong =
            album.type === 'SINGLE' && album.songs?.length === 1 ? album.songs[0] : null

          return (
            <AlbumCard
              key={album.id}
              album={album}
              isOpen={!singleSong && openId === album.id}
              onClick={singleSong ? undefined : () => toggle(album.id)}
              to={singleSong ? `/songs/${singleSong.slug}` : undefined}
            />
          )
        })}
      </div>
      {openAlbum && (
        <div className={styles.expand}>
          <TrackList songs={openAlbum.songs} />
        </div>
      )}
    </section>
  )
}
