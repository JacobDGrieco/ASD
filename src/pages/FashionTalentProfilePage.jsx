import { useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { FaEnvelope, FaGlobe } from 'react-icons/fa'
import { SiInstagram } from 'react-icons/si'
import { useApi } from '../hooks/useApi.js'
import AuroraBackground from '../components/shared/AuroraBackground.jsx'
import ArtworkGallery from '../components/shared/ArtworkGallery.jsx'
import LookCard from '../components/fashion/LookCard.jsx'
import { useAdminAuth } from '../lib/adminAuth.jsx'
import { isAdminPreviewSession, publicPreviewCacheKey, publicPreviewHeaders } from '../lib/publicPreview.js'
import '../styles/Discography.css'
import '../styles/FashionPages.css'

const ROLE_LABEL = {
  MODEL: 'Model',
  DESIGNER: 'Designer',
  PHOTOGRAPHER: 'Photographer',
  EDITOR: 'Photo Editor',
  STYLIST: 'Stylist',
  OTHER: 'Other',
}

export default function FashionTalentProfilePage() {
  const { slug } = useParams()
  const { session, token } = useAdminAuth()
  const adminPreview = isAdminPreviewSession(session, token)
  const apiUrl = `/api/fashion/talent/${slug}`
  const previewHeaders = useMemo(() => publicPreviewHeaders(adminPreview ? token : null), [adminPreview, token])
  const { data: talent, loading, error } = useApi(apiUrl, {
    headers: previewHeaders,
    cacheKey: publicPreviewCacheKey(apiUrl, adminPreview),
  })

  if (!loading && (error || !talent)) return <div className="page not-found"><h1>Not found</h1></div>
  if (!talent) return null

  const image = talent.images?.[0]
  const contactLinks = [
    talent.instagramProfile ? { href: talent.instagramProfile, label: 'Instagram', icon: <SiInstagram /> } : null,
    talent.website ? { href: talent.website, label: 'Website', icon: <FaGlobe /> } : null,
    talent.email ? { href: `mailto:${talent.email}`, label: 'Email', icon: <FaEnvelope /> } : null,
  ].filter(Boolean)

  return (
    <div className="page aurora-page fashion-page">
      <AuroraBackground />
      <div className="aurora-page-content fashion-page-content">
        <section className="fashion-talent-hero">
          <div className="fashion-talent-hero-portrait-wrap">
            <div className="fashion-talent-hero-portrait-frame">
              <ArtworkGallery images={talent.images} title={talent.name} buttonLabel={`View ${talent.name} images`} />
              {image && <img src={image.previewUrl || image.url} alt={talent.name} className="fashion-talent-hero-portrait" />}
            </div>
            {contactLinks.length > 0 && (
              <div className="fashion-talent-hero-links">
                {contactLinks.map((link) => (
                  <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label} title={link.label}>
                    {link.icon}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="fashion-talent-hero-info">
            <span className="fashion-talent-hero-role">{ROLE_LABEL[talent.role] ?? talent.role}</span>
            <h1 className="fashion-talent-hero-name">{talent.name}</h1>
            {talent.bio && <p className="fashion-talent-hero-bio">{talent.bio}</p>}
            {(talent.agencyName || talent.agencyContact) && (
              <p className="fashion-talent-hero-agency">
                {talent.agencyName && <span>{talent.agencyName}</span>}
                {talent.agencyContact && <span> · {talent.agencyContact}</span>}
              </p>
            )}
          </div>
        </section>

        {talent.featuredIn?.length > 0 && (
          <section className="discography-section">
            <h2 className="discography-heading">Featured In</h2>
            <div className="discography-grid">
              {talent.featuredIn.map((credit, index) => (
                credit.look ? <LookCard key={`${credit.look.id}-${index}`} look={credit.look} /> : null
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
