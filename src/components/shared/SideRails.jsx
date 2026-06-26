import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import '../../styles/SideRails.css'

const LEFT_RAIL_TEXT = Array.from({ length: 18 }, (_, index) => `left-${index}`)
const MUSIC_FALLBACK_NAMES = ['Aim', 'ben das', 'certo1k', 'notfaave', 'addisonnn']
const FASHION_FALLBACK_NAMES = ['Models', 'Designers', 'Stylists', 'Photographers', 'Editors']
const RIGHT_RAIL_COUNT = 24
const RIGHT_RAIL_ROTATE_MS = 60 * 1000
const RIGHT_RAIL_TRANSITION_MS = 760

function getPublicSection(pathname) {
  if (pathname === '/fashion' || pathname.startsWith('/fashion/')) return 'fashion'
  if (
    pathname === '/music' ||
    pathname.startsWith('/music/') ||
    ['/board', '/videos', '/crosshair'].some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith('/artists/') ||
    pathname.startsWith('/albums/') ||
    pathname.startsWith('/songs/')
  ) {
    return 'music'
  }

  return null
}

function getRightRailNames(names, startIndex) {
  if (!names.length) return []
  return Array.from({ length: RIGHT_RAIL_COUNT }, (_, index) => names[(startIndex + index) % names.length])
}

function getDisplayNames(rows, fallbackNames) {
  const names = (Array.isArray(rows) ? rows : [])
    .map((row) => row?.name)
    .filter((name) => typeof name === 'string' && name.trim())
    .map((name) => name.trim())

  return names.length ? names : fallbackNames
}

export default function SideRails() {
  const location = useLocation()
  const section = getPublicSection(location.pathname)
  const railApiUrl = section === 'fashion'
    ? '/api/fashion/talent'
    : section === 'music'
      ? '/api/artists'
      : null
  const fallbackNames = section === 'fashion' ? FASHION_FALLBACK_NAMES : MUSIC_FALLBACK_NAMES
  const { data: railRows } = useApi(railApiUrl)
  const rightRailSourceNames = useMemo(
    () => getDisplayNames(railRows, fallbackNames),
    [fallbackNames, railRows]
  )
  const [rightRailState, setRightRailState] = useState({
    currentIndex: 0,
    previousIndex: null,
    transitionKey: 0,
  })

  useEffect(() => {
    setRightRailState({
      currentIndex: 0,
      previousIndex: null,
      transitionKey: 0,
    })
  }, [section, rightRailSourceNames.length])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRightRailState((current) => ({
        currentIndex: (current.currentIndex + 1) % rightRailSourceNames.length,
        previousIndex: current.currentIndex,
        transitionKey: current.transitionKey + 1,
      }))
    }, RIGHT_RAIL_ROTATE_MS)

    return () => window.clearInterval(intervalId)
  }, [rightRailSourceNames.length])

  useEffect(() => {
    if (rightRailState.previousIndex === null) return undefined

    const timeoutId = window.setTimeout(() => {
      setRightRailState((current) => (
        current.transitionKey === rightRailState.transitionKey
          ? { ...current, previousIndex: null }
          : current
      ))
    }, RIGHT_RAIL_TRANSITION_MS)

    return () => window.clearTimeout(timeoutId)
  }, [rightRailState.previousIndex, rightRailState.transitionKey])

  const currentRightRailNames = useMemo(
    () => getRightRailNames(rightRailSourceNames, rightRailState.currentIndex),
    [rightRailSourceNames, rightRailState.currentIndex]
  )

  const previousRightRailNames = useMemo(
    () => rightRailState.previousIndex === null ? [] : getRightRailNames(rightRailSourceNames, rightRailState.previousIndex),
    [rightRailSourceNames, rightRailState.previousIndex]
  )

  if (!section || location.pathname.startsWith('/admin')) return null

  return (
    <div className="side-rails" aria-hidden="true">
      <div className="side-rails-rail side-rails-rail-left">
        <div className="side-rails-column side-rails-column-left">
          {LEFT_RAIL_TEXT.map((key) => (
            <span key={key}>ASD RECORDS</span>
          ))}
        </div>
      </div>
      <div className="side-rails-rail side-rails-rail-right">
        <div className="side-rails-right-stack">
          {rightRailState.previousIndex !== null && (
            <div
              key={`right-exit-${rightRailState.transitionKey}`}
              className="side-rails-column side-rails-column-right side-rails-column-right-exit"
            >
              {previousRightRailNames.map((name, index) => (
                <span key={`right-prev-${rightRailState.transitionKey}-${index}`}>{name}</span>
              ))}
            </div>
          )}
          <div
            key={`right-current-${rightRailState.currentIndex}-${rightRailState.transitionKey}`}
            className={`side-rails-column side-rails-column-right ${rightRailState.previousIndex !== null ? 'side-rails-column-right-enter' : ''}`.trim()}
          >
            {currentRightRailNames.map((name, index) => (
              <span key={`right-current-${rightRailState.currentIndex}-${index}`}>{name}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
