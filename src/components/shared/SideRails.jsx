import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import '../../styles/SideRails.css'

const LEFT_RAIL_TEXT = Array.from({ length: 18 }, (_, index) => `left-${index}`)
const ARTIST_NAMES = ['Aim', 'ben das', 'certo1k', 'notfaave', 'addisonnn']
const RIGHT_RAIL_COUNT = 24
const RIGHT_RAIL_ROTATE_MS = 60 * 1000

export default function SideRails() {
  const location = useLocation()
  const [startIndex, setStartIndex] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setStartIndex((current) => (current + 1) % ARTIST_NAMES.length)
    }, RIGHT_RAIL_ROTATE_MS)

    return () => window.clearInterval(intervalId)
  }, [])

  const rightRailNames = useMemo(
    () => Array.from({ length: RIGHT_RAIL_COUNT }, (_, index) => ARTIST_NAMES[(startIndex + index) % ARTIST_NAMES.length]),
    [startIndex]
  )

  if (location.pathname.startsWith('/admin')) return null

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
        <div className="side-rails-column side-rails-column-right">
          {rightRailNames.map((name, index) => (
            <span key={`right-${startIndex}-${index}`}>{name}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
