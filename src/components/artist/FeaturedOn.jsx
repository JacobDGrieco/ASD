import { useState } from 'react'
import AlbumCard from './AlbumCard.jsx'
import TrackList from './TrackList.jsx'
import '../../styles/Discography.css'

export default function FeaturedOn({ featuredIn }) {
  const [openId, setOpenId] = useState(null)

  if (!featuredIn?.length) return null

  function toggle(id) {
    setOpenId((prev) => (prev === id ? null : id))
  }

  const openAlbum = featuredIn.find((a) => a.id === openId)

  return (
    <section className="discography-section">
      <h2 className="discography-heading">Featured On</h2>
      <div className="discography-grid">
        {featuredIn.map((album) => {
          const singleSong = album.songs?.length === 1 ? album.songs[0] : null
          return (
            <AlbumCard
              key={album.id}
              album={album}
              isOpen={!singleSong && openId === album.id}
              subtitle={album.artist?.name}
              onClick={!singleSong ? () => toggle(album.id) : undefined}
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
