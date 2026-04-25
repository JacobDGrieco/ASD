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

export default function SoundCloudPlayer({ url, isPlaying = false, hidden = false }) {
  const iframeRef = useRef(null)
  const widgetRef = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [widgetApiFailed, setWidgetApiFailed] = useState(false)

  const src = useMemo(() => {
    if (!url) return null

    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23c8a96e&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false`
  }, [url])

  useEffect(() => {
    setIsReady(false)
    widgetRef.current = null
    setWidgetApiFailed(false)

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

    if (isPlaying) {
      widgetRef.current.play()
      return
    }

    widgetRef.current.pause()
  }, [isPlaying, isReady, url])

  if (!url) return null

  return (
    <iframe
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
