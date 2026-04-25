import AlbumCard from './AlbumCard.jsx'
import '../../styles/Discography.css'

export default function Discography({ albums, artistSlug }) {
  return (
    <section className="discography-section">
      <h2 className="discography-heading">Discography</h2>
      <div className="discography-grid">
        {albums.map((album) => {
          const hasSongs = (album.songs?.length ?? 0) > 0
          const isUnreleased = !hasSongs
          const singleSong =
            album.type === 'SINGLE' && album.songs?.length === 1 ? album.songs[0] : null

          const to = isUnreleased
            ? undefined
            : singleSong
            ? `/${artistSlug}/${album.slug}/${singleSong.slug}`
            : `/${artistSlug}/${album.slug}`

          return (
            <AlbumCard
              key={album.id}
              album={album}
              isUnreleased={isUnreleased}
              to={to}
            />
          )
        })}
      </div>
    </section>
  )
}
