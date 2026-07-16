import { useParams, Link } from 'react-router-dom'
import { useMemo, useRef, useState, useEffect, useSyncExternalStore } from 'react'
import { FaShoppingBag, FaUsers, FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import { useApi } from '../hooks/useApi.js'
import AuroraBackground from '../components/shared/AuroraBackground.jsx'
import { usePageTitle } from '../lib/pageTitle.js'
import '../styles/FashionPages.css'

const CREDIT_ROLE_PRIORITY = new Map([
  ['MODEL', 0],
  ['PHOTOGRAPHER', 10],
  ['AGENCY', 20],
  ['BRAND', 30],
  ['STYLIST', 40],
  ['WARDROBE STYLIST', 41],
  ['DESIGNER', 50],
  ['CREATIVE DIRECTOR', 60],
  ['ART DIRECTOR', 70],
  ['MAKEUP ARTIST', 80],
  ['HAIR STYLIST', 90],
  ['NAIL ARTIST', 100],
  ['CASTING DIRECTOR', 110],
  ['PRODUCER', 120],
  ['SET DESIGNER', 130],
  ['PHOTO ASSISTANT', 140],
  ['DIGITAL TECH', 150],
  ['RETOUCHER', 160],
  ['TAILOR', 170],
  ['SEAMSTRESS', 180],
  ['LOCATION SCOUT', 190],
  ['EDITOR', 200],
  ['OTHER', 900],
])

function normalizeCreditRole(role) {
  return String(role ?? '').trim().replace(/_/g, ' ').replace(/\s+/g, ' ').toUpperCase()
}

function creditRolePriority(credit) {
  const candidates = [credit?.roleLabel, credit?.talent?.role]
  for (const candidate of candidates) {
    const priority = CREDIT_ROLE_PRIORITY.get(normalizeCreditRole(candidate))
    if (priority !== undefined) return priority
  }
  return 999
}

function creditKey(credit) {
  return credit?.id
    ?? credit?.talent?.id
    ?? credit?.talent?.slug
    ?? credit?.crew?.id
    ?? `${credit?.roleLabel || credit?.talent?.role || 'credit'}:${credit?.creditName || credit?.talent?.name || ''}:${credit?.externalUrl || ''}`
}

function isModelCredit(credit) {
  return creditRolePriority(credit) === CREDIT_ROLE_PRIORITY.get('MODEL')
}

function sortCreditsByImportance(credits) {
  return (Array.isArray(credits) ? credits : [])
    .map((credit, index) => ({ credit, index }))
    .sort((a, b) => creditRolePriority(a.credit) - creditRolePriority(b.credit) || a.index - b.index)
    .map(({ credit }) => credit)
}

function CreditsRow({ credits }) {
  const sortedCredits = sortCreditsByImportance(credits)
  if (!sortedCredits.length) return null

  return (
    <div className="fashion-look-credits-row">
      {sortedCredits.map((credit) => {
        const creditName = credit.creditName || credit.talent?.name || ''
        if (!creditName) return null

        if (credit.talent) return (
          <Link key={creditKey(credit)} to={`/fashion/talent/${credit.talent.slug}`} className="fashion-look-credit-chip">
            <span className="fashion-look-credit-role">{credit.roleLabel || 'Credit'}</span>
            <span className="fashion-look-credit-name">{creditName}</span>
          </Link>
        )

        return credit.externalUrl ? (
          <a key={creditKey(credit)} href={credit.externalUrl} target="_blank" rel="noreferrer" className="fashion-look-credit-chip">
            <span className="fashion-look-credit-role">{credit.roleLabel || 'Credit'}</span>
            <span className="fashion-look-credit-name">{creditName}</span>
          </a>
        ) : (
          <span key={creditKey(credit)} className="fashion-look-credit-chip">
            <span className="fashion-look-credit-role">{credit.roleLabel || 'Credit'}</span>
            <span className="fashion-look-credit-name">{creditName}</span>
          </span>
        )
      })}
    </div>
  )
}

function ModelCreditCard({ credit }) {
  const name = credit.creditName || credit.talent?.name || ''
  if (!name) return null

  const image = credit.image
  const slug = credit.talent?.slug
  const externalUrl = credit.externalUrl
  const inner = (
    <>
      <span className="fashion-look-model-image-wrap">
        {image ? (
          <img src={image.previewUrl || image.url} alt={name} className="fashion-look-model-image" />
        ) : (
          <span className="fashion-look-model-image-blank" />
        )}
      </span>
      <span className="fashion-look-model-name">{name}</span>
    </>
  )

  if (slug) {
    return (
      <Link to={`/fashion/talent/${slug}`} className="fashion-look-model-card">
        {inner}
      </Link>
    )
  }

  if (externalUrl) {
    return (
      <a href={externalUrl} target="_blank" rel="noreferrer" className="fashion-look-model-card">
        {inner}
      </a>
    )
  }

  return (
    <span className="fashion-look-model-card">
      {inner}
    </span>
  )
}

function ModelsRow({ credits }) {
  const sortedCredits = sortCreditsByImportance(credits)
  const [activeIndex, setActiveIndex] = useState(0)
  const hasControls = sortedCredits.length > 3
  const maxIndex = Math.max(0, sortedCredits.length - 3)
  const visibleStartIndex = Math.min(activeIndex, maxIndex)
  const visibleCredits = hasControls
    ? sortedCredits.slice(visibleStartIndex, visibleStartIndex + 3)
    : sortedCredits

  if (!sortedCredits.length) return null

  return (
    <div className="fashion-look-models">
      <span className="fashion-look-models-label">Models</span>
      <div className="fashion-look-models-controls">
        {hasControls && (
          <button
            type="button"
            className="fashion-look-gallery-arrow"
            onClick={() => setActiveIndex(Math.max(0, visibleStartIndex - 1))}
            disabled={visibleStartIndex === 0}
            aria-label="Previous models"
          >
            <FaChevronLeft />
          </button>
        )}
        <div className="fashion-look-models-row">
          {visibleCredits.map((credit) => (
            <ModelCreditCard key={creditKey(credit)} credit={credit} />
          ))}
        </div>
        {hasControls && (
          <button
            type="button"
            className="fashion-look-gallery-arrow"
            onClick={() => setActiveIndex(Math.min(maxIndex, visibleStartIndex + 1))}
            disabled={visibleStartIndex === maxIndex}
            aria-label="Next models"
          >
            <FaChevronRight />
          </button>
        )}
      </div>
    </div>
  )
}

function CreditCard({ credit }) {
  const name = credit.creditName || ''
  const image = credit.image
  const slug = credit.talent?.slug
  const externalUrl = credit.externalUrl

  const inner = (
    <>
      <div className="fashion-credit-card-image-wrap">
        {image
          ? <img src={image.previewUrl || image.url} alt={name} className="fashion-credit-card-image" />
          : <div className="fashion-credit-card-image-blank" />
        }
      </div>
      <div className="fashion-credit-card-info">
        <span className="fashion-credit-card-role">{credit.roleLabel || 'Credit'}</span>
        <span className="fashion-credit-card-name">{name}</span>
      </div>
    </>
  )

  return slug
    ? <Link to={`/fashion/talent/${slug}`} className="fashion-credit-card">{inner}</Link>
    : externalUrl
      ? <a href={externalUrl} target="_blank" rel="noreferrer" className="fashion-credit-card">{inner}</a>
    : <div className="fashion-credit-card">{inner}</div>
}

export function CreditsCarousel({ credits }) {
  const sortedCredits = sortCreditsByImportance(credits)
  if (!sortedCredits.length) return null
  return (
    <section className="fashion-look-credits-section">
      <h2 className="discography-heading">Credits</h2>
      <div className="fashion-credits-carousel">
        {sortedCredits.map((credit) => (
          <CreditCard key={creditKey(credit)} credit={credit} />
        ))}
      </div>
    </section>
  )
}

function PieceCreditMiniCard({ credit }) {
  const name = credit.creditName || credit.talent?.name || ''
  if (!name) return null

  const image = credit.image
  const slug = credit.talent?.slug
  const externalUrl = credit.externalUrl
  const inner = (
    <>
      <div className="fashion-piece-credit-mini-image-wrap">
        {image
          ? <img src={image.previewUrl || image.url} alt={name} className="fashion-piece-credit-mini-image" />
          : <div className="fashion-piece-credit-mini-image-blank" />
        }
      </div>
      <div className="fashion-piece-credit-mini-info">
        <span className="fashion-piece-credit-mini-role">{credit.roleLabel || 'Credit'}</span>
        <span className="fashion-piece-credit-mini-name">{name}</span>
      </div>
    </>
  )

  if (slug) {
    return <Link to={`/fashion/talent/${slug}`} className="fashion-piece-credit-mini-card">{inner}</Link>
  }

  if (externalUrl) {
    return <a href={externalUrl} target="_blank" rel="noreferrer" className="fashion-piece-credit-mini-card">{inner}</a>
  }

  return <div className="fashion-piece-credit-mini-card">{inner}</div>
}

function PieceCreditsPopover({ credits }) {
  const sortedCredits = sortCreditsByImportance(credits).filter((credit) => credit.creditName || credit.talent?.name)
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [popoverStyle, setPopoverStyle] = useState(null)
  const containerRef = useRef(null)
  const popoverRef = useRef(null)
  const pageSize = 4
  const pageCount = Math.max(1, Math.ceil(sortedCredits.length / pageSize))
  const maxPage = pageCount - 1
  const currentPage = Math.min(page, maxPage)
  const visibleCredits = sortedCredits.slice(currentPage * pageSize, currentPage * pageSize + pageSize)

  useEffect(() => {
    if (!open) return undefined

    const updatePopoverPosition = () => {
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return

      const viewportPadding = 12
      const gap = 8
      const popoverHeight = popoverRef.current?.offsetHeight ?? 360
      const spaceAbove = containerRect.top - viewportPadding
      const spaceBelow = window.innerHeight - containerRect.bottom - viewportPadding
      const placement = spaceBelow >= popoverHeight || spaceBelow >= spaceAbove ? 'below' : 'above'
      const desiredViewportTop = placement === 'below'
        ? containerRect.bottom + gap
        : containerRect.top - popoverHeight - gap
      const clampedViewportTop = Math.max(
        viewportPadding,
        Math.min(desiredViewportTop, window.innerHeight - popoverHeight - viewportPadding)
      )

      setPopoverStyle({
        top: `${clampedViewportTop - containerRect.top}px`,
        '--popover-max-height': `${Math.max(180, window.innerHeight - (viewportPadding * 2))}px`,
        placement,
      })
    }

    const handleOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setPopoverStyle(null)
        setOpen(false)
      }
    }

    updatePopoverPosition()
    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('resize', updatePopoverPosition)
      window.removeEventListener('scroll', updatePopoverPosition, true)
    }
  }, [open, currentPage, visibleCredits.length])

  if (!sortedCredits.length) return null

  return (
    <div className="fashion-piece-credits-popover-wrap" ref={containerRef}>
      <button
        type="button"
        className="fashion-piece-credits-toggle"
        onClick={() => {
          setPopoverStyle(null)
          setOpen((current) => !current)
        }}
        aria-expanded={open}
        aria-label="Extra Credits"
      >
        <FaUsers aria-hidden="true" />
      </button>
      {open && (
        <div
          className={`fashion-piece-credits-popover${popoverStyle ? ' fashion-piece-credits-popover--ready' : ''}`}
          ref={popoverRef}
          style={popoverStyle ?? undefined}
          data-placement={popoverStyle?.placement ?? 'below'}
        >
          <div className="fashion-piece-credits-popover-header">
            <div className="fashion-piece-credits-popover-heading">
              <span>Extra Credits</span>
              {pageCount > 1 && <span>{currentPage + 1}/{pageCount}</span>}
            </div>
            {pageCount > 1 && (
              <div className="fashion-piece-credits-popover-controls">
                <button
                  type="button"
                  className="fashion-look-gallery-arrow"
                  onClick={() => setPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  aria-label="Previous piece credits"
                >
                  <FaChevronLeft />
                </button>
                <button
                  type="button"
                  className="fashion-look-gallery-arrow"
                  onClick={() => setPage(Math.min(maxPage, currentPage + 1))}
                  disabled={currentPage === maxPage}
                  aria-label="Next piece credits"
                >
                  <FaChevronRight />
                </button>
              </div>
            )}
          </div>
          <div className="fashion-piece-credits-popover-grid">
            {visibleCredits.map((credit) => (
              <PieceCreditMiniCard key={creditKey(credit)} credit={credit} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getThumbsVisible(width) {
  if (width < 640) return 3
  if (width < 980) return 5
  return 7
}

function subscribeToWindowResize(callback) {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

function getThumbsVisibleSnapshot() {
  return getThumbsVisible(window.innerWidth)
}

function getServerThumbsVisibleSnapshot() {
  return 7
}

export default function FashionLookPage() {
  const { slug } = useParams()
  const apiUrl = `/api/fashion/looks/${slug}`
  const { data: look, loading, error } = useApi(apiUrl)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const thumbsVisible = useSyncExternalStore(
    subscribeToWindowResize,
    getThumbsVisibleSnapshot,
    getServerThumbsVisibleSnapshot
  )
  const titleParts = useMemo(() => {
    if (!look) return null
    const credits = sortCreditsByImportance(look.credits ?? [])
    const primaryCredit = credits.find(isModelCredit) ?? credits[0]
    const primaryName = primaryCredit?.creditName || primaryCredit?.talent?.name
    return [look.title, primaryName]
  }, [look])
  usePageTitle(titleParts)

  if (!loading && (error || !look)) return <div className="page not-found"><h1>Look not found</h1></div>
  if (!look) return null

  const images = look.images ?? []
  const allCredits = sortCreditsByImportance(look.credits ?? [])
  const modelCredits = allCredits.filter(isModelCredit)
  const crewCredits = allCredits.filter(c => !isModelCredit(c))
  const activeImage = images[activeImageIndex] ?? images[0]
  const prevImage = () => setActiveImageIndex(i => Math.max(0, i - 1))
  const nextImage = () => setActiveImageIndex(i => Math.min(images.length - 1, i + 1))

  const THUMB_STRIDE = 76 // 68px thumb + 8px gap
  const trackStart = Math.max(0, Math.min(images.length - thumbsVisible, activeImageIndex - Math.floor((thumbsVisible - 1) / 2)))
  const trackOffset = trackStart * THUMB_STRIDE

  return (
    <div className="page aurora-page fashion-page">
      <AuroraBackground />
      <div className="aurora-page-content fashion-page-content">
        <section className="fashion-look-hero">
          <div className="fashion-look-gallery">
            <div className="fashion-look-gallery-main">
              {activeImage ? (
                <img src={activeImage.previewUrl || activeImage.url} alt={look.title} className="fashion-look-gallery-image" />
              ) : (
                <div className="fashion-look-gallery-blank" />
              )}
            </div>
            {images.length > 1 && (
              <div className="fashion-look-gallery-controls">
                <button
                  type="button"
                  className="fashion-look-gallery-arrow"
                  onClick={prevImage}
                  disabled={activeImageIndex === 0}
                  aria-label="Previous image"
                >
                  <FaChevronLeft />
                </button>
                <div className="fashion-look-gallery-thumbs">
                  <div
                    className="fashion-look-gallery-thumbs-track"
                    style={{ transform: `translateX(-${trackOffset}px)` }}
                  >
                    {images.map((image, index) => (
                      <button
                        key={image.id ?? image.pathname ?? image.url ?? image.previewUrl}
                        type="button"
                        onClick={() => setActiveImageIndex(index)}
                        className={`fashion-look-gallery-thumb ${index === activeImageIndex ? 'fashion-look-gallery-thumb-active' : ''}`.trim()}
                        aria-label={`View image ${index + 1}`}
                      >
                        <img src={image.previewUrl || image.url} alt="" />
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="fashion-look-gallery-arrow"
                  onClick={nextImage}
                  disabled={activeImageIndex === images.length - 1}
                  aria-label="Next image"
                >
                  <FaChevronRight />
                </button>
              </div>
            )}
          </div>

          <div className="fashion-look-info">
            <h1 className="fashion-look-title">{look.title}</h1>
            <ModelsRow credits={modelCredits} />
            {look.description && <p className="fashion-look-description">{look.description}</p>}
          </div>
        </section>

        {look.pieces?.length > 0 && (
          <section className="fashion-look-pieces-section">
            <h2 className="discography-heading">Shop This Look</h2>
            <div className="fashion-pieces-grid">
              {look.pieces.map((piece) => (
                <div key={piece.id} className="fashion-piece-card">
                  <div className="fashion-piece-card-image-wrap">
                    {piece.image ? (
                      <img src={piece.image.previewUrl || piece.image.url} alt={piece.name} className="fashion-piece-card-image" />
                    ) : (
                      <div className="fashion-piece-card-image-blank" />
                    )}
                  </div>
                  <div className="fashion-piece-card-info">
                    <span className="fashion-piece-card-name">{piece.name}</span>
                    <div className="fashion-piece-card-actions">
                      {piece.buyUrl && (
                        <a href={piece.buyUrl} target="_blank" rel="noreferrer" className="fashion-piece-card-buy-link" aria-label="Shop">
                          <FaShoppingBag aria-hidden="true" />
                        </a>
                      )}
                      <PieceCreditsPopover credits={piece.credits} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <CreditsCarousel credits={crewCredits} />
      </div>
    </div>
  )
}
