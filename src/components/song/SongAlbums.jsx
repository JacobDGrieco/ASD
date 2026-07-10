import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import AlbumCard from '../artist/AlbumCard.jsx'
import TrackList from '../artist/TrackList.jsx'
import '../../styles/SongAlbums.css'

function releaseTime(album) {
  const time = album?.releaseDate ? new Date(album.releaseDate).getTime() : 0
  return Number.isNaN(time) ? 0 : time
}

export default function SongAlbums({ placements, adminPreview = false }) {
  const gridRef = useRef(null)
  const [openAlbumId, setOpenAlbumId] = useState(null)
  const [columns, setColumns] = useState(1)
  const albums = useMemo(() => {
    const seen = new Set()
    return (placements ?? [])
      .reduce((uniqueAlbums, placement) => {
        const album = placement.album
        if (!album?.id || seen.has(album.id)) return uniqueAlbums
        seen.add(album.id)
        uniqueAlbums.push(album)
        return uniqueAlbums
      }, [])
      .sort((left, right) => releaseTime(right) - releaseTime(left))
  }, [placements])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const updateColumns = () => {
      const nextColumns = Number.parseInt(
        getComputedStyle(grid).getPropertyValue('--song-albums-columns'),
        10,
      ) || 1
      setColumns(nextColumns)
    }

    updateColumns()

    const observer = new ResizeObserver(() => updateColumns())
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])

  const activeOpenAlbumId = albums.some((album) => album.id === openAlbumId) ? openAlbumId : null
  const openAlbumIndex = albums.findIndex((album) => album.id === activeOpenAlbumId)
  const openAlbum = openAlbumIndex === -1 ? null : albums[openAlbumIndex]
  const openRowEndIndex = openAlbum
    ? Math.min(albums.length - 1, Math.floor(openAlbumIndex / columns) * columns + columns - 1)
    : -1

  if (!albums.length) {
    return <p className="page-tab-empty-state">Albums will show up here.</p>
  }

  return (
    <section className="song-albums-section">
      <div ref={gridRef} className="song-albums-grid">
        {albums.map((album, albumIndex) => {
          const hasSongs = (album.songs?.length ?? 0) > 0
          const isTracklistAlbum = album.type === 'ALBUM' || album.type === 'EP'
          const isExpandable = hasSongs && isTracklistAlbum
          const isOpen = activeOpenAlbumId === album.id

          return (
            <Fragment key={album.id}>
              <AlbumCard
                album={album}
                isOpen={isOpen}
                isDisabled={!isExpandable}
                isUnreleased={!hasSongs}
                onClick={isExpandable ? () => setOpenAlbumId((current) => (current === album.id ? null : album.id)) : undefined}
              />
              {openAlbum && albumIndex === openRowEndIndex && (
                <div className="song-albums-expand" key={`${openAlbum.id}-expand`}>
                  <TrackList
                    songs={openAlbum.songs}
                    albumHref={`/albums/${openAlbum.id}`}
                    albumTitle={openAlbum.title}
                    allowHidden={adminPreview}
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
