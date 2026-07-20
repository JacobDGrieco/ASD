import { useEffect, useRef, useState } from 'react'
import { FaPause, FaPlay, FaStepBackward, FaStepForward } from 'react-icons/fa'
import '../../styles/Player.css'

export default function PlayerIpod({
  artworkUrl = '',
  className = '',
  isPlaying = false,
  onClose,
  onHubClick,
  onMenu,
  onNext,
  onPrev,
  onScreenClick,
  screenAriaLabel = 'Open player',
  screenContent = null,
  title = '',
  titlePrefix = null,
  titleSuffix = null,
}) {
  const titleFrameRef = useRef(null)
  const titleMeasureRef = useRef(null)
  const titleTextRef = useRef(null)
  const [shouldPanTitle, setShouldPanTitle] = useState(false)

  useEffect(() => {
    if (!title || screenContent) return undefined

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
  }, [screenContent, title])

  return (
    <aside className={`player-widget ${className}`.trim()} aria-label="Music player">
      <span className="player-widget-shell" aria-hidden="true" />
      <button type="button" className="player-widget-screen" onClick={onScreenClick} aria-label={screenAriaLabel}>
        {screenContent ?? (
          <>
            {artworkUrl ? (
              <img src={artworkUrl} alt="" className="player-widget-art" />
            ) : (
              <span className="player-widget-art player-widget-art-empty" aria-hidden="true" />
            )}
            <span
              ref={titleFrameRef}
              className={`player-widget-title ${shouldPanTitle ? 'player-widget-title-panning' : ''}`.trim()}
            >
              {titlePrefix}
              <span ref={titleTextRef} className="player-widget-title-text">{title}</span>
              <span ref={titleMeasureRef} className="player-widget-title-measure" aria-hidden="true">{title}</span>
              {titleSuffix}
            </span>
          </>
        )}
      </button>
      <div className="player-widget-wheel" aria-label="Playback controls">
        <div className="player-widget-wheel-controls">
          <button type="button" className="player-wheel-menu" onClick={onMenu}>Menu</button>
          <button type="button" className="player-wheel-prev" onClick={onPrev} aria-label="Previous track">
            <FaStepBackward aria-hidden="true" />
          </button>
          <button type="button" className="player-wheel-next" onClick={onNext} aria-label="Next track">
            <FaStepForward aria-hidden="true" />
          </button>
          <button type="button" className="player-wheel-close" onClick={onClose} aria-label="Close player">
            <span className="player-wheel-close-mark" aria-hidden="true" />
          </button>
          <button type="button" className="player-wheel-hub" onClick={onHubClick} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <FaPause aria-hidden="true" /> : <FaPlay aria-hidden="true" />}
          </button>
        </div>
      </div>
    </aside>
  )
}
