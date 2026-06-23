import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import '../../styles/SideRails.css'

const LEFT_RAIL_TEXT = Array.from({ length: 18 }, (_, index) => `left-${index}`)
const ARTIST_NAMES = ['Aim', 'ben das', 'certo1k', 'notfaave', 'addisonnn']
const RIGHT_RAIL_COUNT = 24
const RIGHT_RAIL_ROTATE_MS = 60 * 1000
const RIGHT_RAIL_TRANSITION_MS = 760

function getRightRailNames(startIndex) {
  return Array.from({ length: RIGHT_RAIL_COUNT }, (_, index) => ARTIST_NAMES[(startIndex + index) % ARTIST_NAMES.length])
}

export default function SideRails() {
  const location = useLocation()
  const [rightRailState, setRightRailState] = useState({
    currentIndex: 0,
    previousIndex: null,
    transitionKey: 0,
  })

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRightRailState((current) => ({
        currentIndex: (current.currentIndex + 1) % ARTIST_NAMES.length,
        previousIndex: current.currentIndex,
        transitionKey: current.transitionKey + 1,
      }))
    }, RIGHT_RAIL_ROTATE_MS)

    return () => window.clearInterval(intervalId)
  }, [])

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
    () => getRightRailNames(rightRailState.currentIndex),
    [rightRailState.currentIndex]
  )

  const previousRightRailNames = useMemo(
    () => rightRailState.previousIndex === null ? [] : getRightRailNames(rightRailState.previousIndex),
    [rightRailState.previousIndex]
  )

  if (location.pathname === '/' || location.pathname.startsWith('/admin')) return null

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
