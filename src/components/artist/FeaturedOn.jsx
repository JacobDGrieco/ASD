import AlbumCard from './AlbumCard.jsx'
import '../../styles/Discography.css'

export default function FeaturedOn({ featuredIn }) {
  if (!featuredIn?.length) return null

  return (
    <section className="discography-section">
      <h2 className="discography-heading">Featured On</h2>
      <div className="discography-grid">
        {featuredIn.map((album) => {
          const singleSong = album.songs?.length === 1 ? album.songs[0] : null
          const to = singleSong
            ? `/${album.artist.slug}/${album.slug}/${singleSong.slug}`
            : `/${album.artist.slug}/${album.slug}`
          return (
            <AlbumCard
              key={album.id}
              album={album}
              subtitle={album.artist?.name}
              to={to}
            />
          )
        })}
      </div>
    </section>
  )
}
