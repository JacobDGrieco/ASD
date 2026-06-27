import { useParams, Link } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import { FaExternalLinkAlt, FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import { useApi } from '../hooks/useApi.js'
import AuroraBackground from '../components/shared/AuroraBackground.jsx'
import { useAdminAuth } from '../lib/adminAuth.jsx'
import { isAdminPreviewSession, publicPreviewCacheKey, publicPreviewHeaders } from '../lib/publicPreview.js'
import '../styles/FashionPages.css'

function CreditsRow({ credits }) {
  if (!credits?.length) return null

  return (
    <div className="fashion-look-credits-row">
      {credits.map((credit, index) => {
        const creditName = credit.creditName || credit.talent?.name || ''
        if (!creditName) return null

        return credit.talent ? (
          <Link key={`${credit.id ?? credit.talent.id}-${index}`} to={`/fashion/talent/${credit.talent.slug}`} className="fashion-look-credit-chip">
            <span className="fashion-look-credit-role">{credit.roleLabel || 'Credit'}</span>
            <span className="fashion-look-credit-name">{creditName}</span>
          </Link>
        ) : (
          <span key={`${credit.id ?? creditName}-${index}`} className="fashion-look-credit-chip">
            <span className="fashion-look-credit-role">{credit.roleLabel || 'Credit'}</span>
            <span className="fashion-look-credit-name">{creditName}</span>
          </span>
        )
      })}
    </div>
  )
}

function CreditCard({ credit }) {
  const name = credit.creditName || credit.talent?.name || ''
  const image = credit.talent?.image
  const slug = credit.talent?.slug

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
    : <div className="fashion-credit-card">{inner}</div>
}

function CreditsCarousel({ credits }) {
  if (!credits?.length) return null
  return (
    <section className="fashion-look-credits-section">
      <h2 className="discography-heading">Credits</h2>
      <div className="fashion-credits-carousel">
        {credits.map((credit, index) => (
          <CreditCard key={credit.id ?? index} credit={credit} />
        ))}
      </div>
    </section>
  )
}

function getThumbsVisible(width) {
  if (width < 640) return 3
  if (width < 980) return 5
  return 7
}

export default function FashionLookPage() {
  const { slug } = useParams()
  const { session, token } = useAdminAuth()
  const adminPreview = isAdminPreviewSession(session, token)
  const apiUrl = `/api/fashion/looks/${slug}`
  const previewHeaders = useMemo(() => publicPreviewHeaders(adminPreview ? token : null), [adminPreview, token])
  const { data: look, loading, error } = useApi(apiUrl, {
    headers: previewHeaders,
    cacheKey: publicPreviewCacheKey(apiUrl, adminPreview),
  })
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [thumbsVisible, setThumbsVisible] = useState(() => getThumbsVisible(window.innerWidth))
  useEffect(() => {
    const handler = () => setThumbsVisible(getThumbsVisible(window.innerWidth))
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  if (!loading && (error || !look)) return <div className="page not-found"><h1>Look not found</h1></div>
  if (!look) return null

  const images = look.images ?? []
  const allCredits = look.credits ?? []
  const modelCredits = allCredits.filter(c => c.talent?.role === 'MODEL')
  const crewCredits = allCredits.filter(c => c.talent?.role !== 'MODEL')
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
                        key={image.id ?? index}
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
            <CreditsRow credits={modelCredits} />
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
                    <CreditsRow credits={piece.credits} />
                    {piece.buyUrl && (
                      <a href={piece.buyUrl} target="_blank" rel="noreferrer" className="fashion-piece-card-buy-link">
                        Shop <FaExternalLinkAlt aria-hidden="true" />
                      </a>
                    )}
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
