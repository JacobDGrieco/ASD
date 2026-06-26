import { useParams, Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { FaExternalLinkAlt } from 'react-icons/fa'
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

  if (!loading && (error || !look)) return <div className="page not-found"><h1>Look not found</h1></div>
  if (!look) return null

  const images = look.images ?? []
  const activeImage = images[activeImageIndex] ?? images[0]

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
              <div className="fashion-look-gallery-thumbs">
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
            )}
          </div>

          <div className="fashion-look-info">
            <h1 className="fashion-look-title">{look.title}</h1>
            <CreditsRow credits={look.credits} />
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
      </div>
    </div>
  )
}
