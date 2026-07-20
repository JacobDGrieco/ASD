import { useLayoutEffect, useMemo, useRef } from 'react'
import { usePlayer } from '../../lib/playerContextCore.jsx'

function QueueItem({ song, isCurrent, onClick }) {
  return (
    <button
      type="button"
      className={`player-queue-item ${isCurrent ? 'player-queue-item-current' : ''}`.trim()}
      onClick={onClick}
    >
      {song.artworkUrl ? <img src={song.artworkUrl} alt="" /> : <span aria-hidden="true" />}
      <span className="player-queue-copy">
        <strong>{song.title}</strong>
        <span>{song.artistName || song.albumTitle || 'A.S.D.'}</span>
      </span>
    </button>
  )
}

export default function PlayerQueuePanel() {
  const { currentIndex, history, jumpTo, playOrder, pool } = usePlayer()
  const upNextSectionRef = useRef(null)
  const upcoming = useMemo(() => {
    const cursor = playOrder.indexOf(currentIndex)
    const ordered = cursor === -1 ? playOrder : playOrder.slice(cursor + 1)
    return ordered.filter((index) => pool[index])
  }, [currentIndex, playOrder, pool])

  useLayoutEffect(() => {
    const upNextSection = upNextSectionRef.current
    const scroller = upNextSection?.closest('.player-fullscreen-right')
    if (!upNextSection || !scroller) return

    const upNextRect = upNextSection.getBoundingClientRect()
    const scrollerRect = scroller.getBoundingClientRect()
    const scrollerStyles = window.getComputedStyle(scroller)
    const topInset = Number.parseFloat(scrollerStyles.paddingTop) || 0
    const headerOffset = 14

    scroller.scrollTo({
      top: scroller.scrollTop + upNextRect.top - scrollerRect.top - topInset - headerOffset,
      behavior: 'auto',
    })
  }, [currentIndex, history.length, playOrder, pool])

  return (
    <div className="player-queue-panel">
      {history.length > 0 && (
        <section>
          <div className="player-queue-list">
            {history.slice().reverse().map((index, listIndex) => (
              <QueueItem
                key={`played-${index}-${listIndex}`}
                song={pool[index]}
                onClick={() => jumpTo(index)}
              />
            ))}
          </div>
        </section>
      )}
      <section ref={upNextSectionRef}>
        <h3>Up Next</h3>
        <div className="player-queue-list">
          {pool[currentIndex] && (
            <QueueItem
              song={pool[currentIndex]}
              isCurrent
              onClick={() => jumpTo(currentIndex)}
            />
          )}
          {upcoming.map((index, listIndex) => (
            <QueueItem
              key={`upcoming-${index}-${listIndex}`}
              song={pool[index]}
              onClick={() => jumpTo(index)}
            />
          ))}
        </div>
      </section>
      <div className="player-queue-bottom-spacer" aria-hidden="true" />
    </div>
  )
}
