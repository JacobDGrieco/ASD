import AlbumCard from './AlbumCard.jsx'
import { buildAlbumPath, buildSongPath, isOtherArtist } from '../../lib/publicVisibility.js'
import '../../styles/Discography.css'

export default function FeaturedOn({ featuredIn }) {
  if (!featuredIn?.length) return null

  return (
    <section className="discography-section">
      <h2 className="discography-heading">Featured On</h2>
      <div className="discography-grid">
        {featuredIn.map((album) => {
          const singleSong = album.songs?.length === 1 ? album.songs[0] : null
          const leadSong = singleSong ?? album.songs?.[0] ?? null
          const to = isOtherArtist(album.artist)
            ? buildSongPath({
                songSlug: leadSong?.slug,
                albumSlug: album.slug,
                artist: album.artist,
              })
            : singleSong
            ? buildSongPath({
                songSlug: singleSong.slug,
                albumSlug: album.slug,
                artistSlug: album.artist.slug,
                artist: album.artist,
              })
            : buildAlbumPath({
                albumSlug: album.slug,
                artistSlug: album.artist.slug,
                artist: album.artist,
              })
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
