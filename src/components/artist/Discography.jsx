import { useState } from 'react'
import AlbumCard from './AlbumCard.jsx'
import TrackList from './TrackList.jsx'
import '../../styles/Discography.css'

export default function Discography({ albums }) {
  const [openId, setOpenId] = useState(null)

  function toggle(id) {
    setOpenId((prev) => (prev === id ? null : id))
  }

  const openAlbum = albums.find((a) => a.id === openId)

  return (
    <section className="discography-section">
      <h2 className="discography-heading">Discography</h2>
      <div className="discography-grid">
        {albums.map((album) => {
          const hasSongs = (album.songs?.length ?? 0) > 0
          const isUnreleased = !hasSongs
          const singleSong =
            album.type === 'SINGLE' && album.songs?.length === 1 ? album.songs[0] : null

          return (
            <AlbumCard
              key={album.id}
              album={album}
              isOpen={hasSongs && !singleSong && openId === album.id}
              isUnreleased={isUnreleased}
              onClick={hasSongs && !singleSong ? () => toggle(album.id) : undefined}
              to={singleSong ? `/songs/${singleSong.slug}` : undefined}
            />
          )
        })}
      </div>
      {openAlbum && openAlbum.songs?.length > 0 && (
        <div className="discography-expand">
          <TrackList songs={openAlbum.songs} />
        </div>
      )}
    </section>
  )
}
