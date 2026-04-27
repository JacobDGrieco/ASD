import { Fragment, useEffect, useRef, useState } from 'react'
import AlbumCard from './AlbumCard.jsx'
import TrackList from './TrackList.jsx'
import '../../styles/Discography.css'

export default function Discography({ albums, artistSlug }) {
  const gridRef = useRef(null)
  const [openAlbumId, setOpenAlbumId] = useState(null)
  const [columns, setColumns] = useState(1)

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const updateColumns = () => {
      const gap = 8
      const cardWidth = 180
      const nextColumns = Math.max(1, Math.floor((grid.clientWidth + gap) / (cardWidth + gap)))
      setColumns(nextColumns)
    }

    updateColumns()

    const observer = new ResizeObserver(() => updateColumns())
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])

  const openAlbumIndex = albums.findIndex((album) => album.id === openAlbumId)
  const openAlbum = openAlbumIndex === -1 ? null : albums[openAlbumIndex]
  const openRowEndIndex = openAlbum
    ? Math.min(albums.length - 1, Math.floor(openAlbumIndex / columns) * columns + columns - 1)
    : -1

  return (
    <section className="discography-section">
      <h2 className="discography-heading">Discography</h2>
      <div ref={gridRef} className="discography-grid">
        {albums.map((album, albumIndex) => {
          const hasSongs = (album.songs?.length ?? 0) > 0
          const isUnreleased = !hasSongs
          const singleSong =
            album.type === 'SINGLE' && album.songs?.length === 1 ? album.songs[0] : null
          const isExpandable = hasSongs && !singleSong
          const isOpen = openAlbumId === album.id
          const to = isUnreleased
            ? undefined
            : singleSong
            ? `/${artistSlug}/${album.slug}/${singleSong.slug}`
            : undefined

          return (
            <Fragment key={album.id}>
              <AlbumCard
                album={album}
                isOpen={isOpen}
                isUnreleased={isUnreleased}
                to={to}
                onClick={isExpandable ? () => setOpenAlbumId((current) => (current === album.id ? null : album.id)) : undefined}
              />
              {openAlbum && albumIndex === openRowEndIndex && (
                <div className="discography-expand" key={`${openAlbum.id}-expand`}>
                  <TrackList
                    songs={openAlbum.songs}
                    artistSlug={artistSlug}
                    albumSlug={openAlbum.slug}
                    albumHref={`/${artistSlug}/${openAlbum.slug}`}
                    albumTitle={openAlbum.title}
                  />
                </div>
              )}
            </Fragment>
          )
        })}
      </div>
    </section>
  )
}
