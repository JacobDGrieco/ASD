import { useEffect, useMemo, useRef, useState } from 'react'

const WIDGET_SCRIPT_SRC = 'https://w.soundcloud.com/player/api.js'

function loadWidgetApi() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.SC?.Widget) return Promise.resolve(window.SC.Widget)

  const existingScript = document.querySelector(`script[src="${WIDGET_SCRIPT_SRC}"]`)

  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve(window.SC?.Widget ?? null), { once: true })
      existingScript.addEventListener('error', reject, { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = WIDGET_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve(window.SC?.Widget ?? null)
    script.onerror = reject
    document.body.appendChild(script)
  })
}

export default function SoundCloudPlayer({
  url,
  isPlaying = false,
  hidden = false,
  autoPlayOnReady = false,
  onPlaybackStart = null,
  onPlaybackPause = null,
  onPlaybackEnd = null,
}) {
  const iframeRef = useRef(null)
  const widgetRef = useRef(null)
  const hasStartedTrackRef = useRef(false)
  const onPlaybackStartRef = useRef(onPlaybackStart)
  const onPlaybackPauseRef = useRef(onPlaybackPause)
  const onPlaybackEndRef = useRef(onPlaybackEnd)
  const [isReady, setIsReady] = useState(false)
  const [widgetApiFailed, setWidgetApiFailed] = useState(false)

  const src = useMemo(() => {
    if (!url) return null

    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23c8a96e&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false`
  }, [url])

  useEffect(() => {
    onPlaybackStartRef.current = onPlaybackStart
    onPlaybackPauseRef.current = onPlaybackPause
    onPlaybackEndRef.current = onPlaybackEnd
  }, [onPlaybackEnd, onPlaybackPause, onPlaybackStart])

  useEffect(() => {
    setIsReady(false)
    widgetRef.current = null
    setWidgetApiFailed(false)
    hasStartedTrackRef.current = false

    if (!url || !iframeRef.current) return undefined

    let isCancelled = false
    let widget = null

    loadWidgetApi()
      .then((Widget) => {
        if (isCancelled || !Widget || !iframeRef.current) return

        widget = Widget(iframeRef.current)
        widgetRef.current = widget

        widget.bind(Widget.Events.READY, () => {
          if (isCancelled) return
          setIsReady(true)
        })

        widget.bind(Widget.Events.PLAY, () => {
          if (isCancelled) return
          onPlaybackStartRef.current?.()
        })

        widget.bind(Widget.Events.PAUSE, () => {
          if (isCancelled) return
          onPlaybackPauseRef.current?.()
        })

        widget.bind(Widget.Events.FINISH, () => {
          if (isCancelled) return
          hasStartedTrackRef.current = false
          onPlaybackEndRef.current?.()
        })
      })
      .catch(() => {
        if (!isCancelled) setWidgetApiFailed(true)
      })

    return () => {
      isCancelled = true
      setIsReady(false)
    }
  }, [url])

  useEffect(() => {
    if (!url || !isReady || !widgetRef.current) return

    const shouldPlay = isPlaying || autoPlayOnReady

    if (shouldPlay) {
      widgetRef.current.setVolume?.(100)

      if (!hasStartedTrackRef.current) {
        widgetRef.current.seekTo?.(0)
        hasStartedTrackRef.current = true
      }

      widgetRef.current.play()
      return
    }

    widgetRef.current.pause()
  }, [autoPlayOnReady, isPlaying, isReady, url])

  if (!url) return null

  return (
    <iframe
      key={src}
      ref={iframeRef}
      title="SoundCloud Player"
      width={hidden ? '1' : '100%'}
      height={hidden ? '1' : '166'}
      scrolling="no"
      frameBorder="no"
      allow="autoplay"
      src={src}
      style={
        hidden
          ? {
              position: 'absolute',
              width: '1px',
              height: '1px',
              opacity: 0,
              pointerEvents: 'none',
            }
          : { borderRadius: '4px' }
      }
      aria-hidden={hidden || undefined}
      data-widget-api-failed={widgetApiFailed ? 'true' : 'false'}
    />
  )
}
