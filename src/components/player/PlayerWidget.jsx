import { useEffect, useRef, useState } from 'react'
import { FaPause, FaPlay, FaStepBackward, FaStepForward } from 'react-icons/fa'
import { usePlayer } from '../../lib/playerContextCore.jsx'
import '../../styles/Player.css'

export default function PlayerWidget() {
  const titleFrameRef = useRef(null)
  const titleMeasureRef = useRef(null)
  const titleTextRef = useRef(null)
  const [shouldPanTitle, setShouldPanTitle] = useState(false)
  const {
    currentSong,
    dismiss,
    isPlaying,
    next,
    openFullScreen,
    playPause,
    prev,
  } = usePlayer()

  useEffect(() => {
    const titleFrame = titleFrameRef.current
    const titleMeasure = titleMeasureRef.current
    const titleText = titleTextRef.current
    if (!titleFrame || !titleMeasure || !titleText) return undefined

    const measureTitle = () => {
      const naturalTitleWidth = Math.ceil(titleMeasure.getBoundingClientRect().width)
      const panDistance = Math.max(0, naturalTitleWidth - titleFrame.clientWidth + 18)
      titleText.style.setProperty('--player-widget-title-pan-distance', `${panDistance}px`)
      setShouldPanTitle(naturalTitleWidth > titleFrame.clientWidth + 2)
    }

    measureTitle()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureTitle)
      return () => window.removeEventListener('resize', measureTitle)
    }

    const resizeObserver = new ResizeObserver(measureTitle)
    resizeObserver.observe(titleFrame)
    resizeObserver.observe(titleMeasure)
    return () => resizeObserver.disconnect()
  }, [currentSong?.title])

  if (!currentSong) return null

  return (
    <aside className="player-widget" aria-label="Music player">
      <span className="player-widget-shell" aria-hidden="true" />
      <button type="button" className="player-widget-screen" onClick={openFullScreen} aria-label="Open player">
        {currentSong.artworkUrl ? (
          <img src={currentSong.artworkUrl} alt="" className="player-widget-art" />
        ) : (
          <span className="player-widget-art player-widget-art-empty" aria-hidden="true" />
        )}
        <span
          ref={titleFrameRef}
          className={`player-widget-title ${shouldPanTitle ? 'player-widget-title-panning' : ''}`.trim()}
        >
          <span ref={titleTextRef} className="player-widget-title-text">{currentSong.title}</span>
          <span ref={titleMeasureRef} className="player-widget-title-measure" aria-hidden="true">{currentSong.title}</span>
        </span>
      </button>
      <div className="player-widget-wheel" aria-label="Playback controls">
        <div className="player-widget-wheel-controls">
          <button type="button" className="player-wheel-menu" onClick={openFullScreen}>Menu</button>
          <button type="button" className="player-wheel-prev" onClick={prev} aria-label="Previous track">
            <FaStepBackward aria-hidden="true" />
          </button>
          <button type="button" className="player-wheel-next" onClick={next} aria-label="Next track">
            <FaStepForward aria-hidden="true" />
          </button>
          <button type="button" className="player-wheel-close" onClick={dismiss} aria-label="Close player">
            <span className="player-wheel-close-mark" aria-hidden="true" />
          </button>
          <button type="button" className="player-wheel-hub" onClick={playPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <FaPause aria-hidden="true" /> : <FaPlay aria-hidden="true" />}
          </button>
        </div>
      </div>
    </aside>
  )
}
