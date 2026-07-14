import { useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { FaEnvelope, FaGlobe } from 'react-icons/fa'
import { SiFacebook, SiInstagram, SiTiktok, SiX, SiYoutube } from 'react-icons/si'
import { Image } from 'primereact/image'
import { TabPanel, TabView } from 'primereact/tabview'
import { useApi } from '../hooks/useApi.js'
import AuroraBackground from '../components/shared/AuroraBackground.jsx'
import ArtworkGallery from '../components/shared/ArtworkGallery.jsx'
import LookCard from '../components/fashion/LookCard.jsx'
import { useAdminAuth } from '../lib/adminAuth.jsx'
import { usePageTitle } from '../lib/pageTitle.js'
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
  const photos = useMemo(() => {
    if (!talent) return []
    const seen = new Set()
    return [
      ...(talent.images ?? []),
      ...(talent.featuredIn ?? []).flatMap((credit) => credit.look?.images ?? []),
    ].filter((photo) => {
      const key = photo.pathname || photo.url
      if (seen.has(key)) return false
      seen.add(key)
      return !!(photo.previewUrl || photo.url)
    })
  }, [talent])
  const titleParts = useMemo(() => talent ? [talent.name] : null, [talent])
  usePageTitle(titleParts)

  if (!loading && (error || !talent)) return <div className="page not-found"><h1>Not found</h1></div>
  if (!talent) return null

  const image = talent.images?.[0]
  const contactLinks = [
    talent.instagramProfile ? { href: talent.instagramProfile, label: 'Instagram', icon: <SiInstagram /> } : null,
    talent.tiktokProfile ? { href: talent.tiktokProfile, label: 'TikTok', icon: <SiTiktok /> } : null,
    talent.twitterProfile ? { href: talent.twitterProfile, label: 'Twitter', icon: <SiX /> } : null,
    talent.youtubeProfile ? { href: talent.youtubeProfile, label: 'YouTube', icon: <SiYoutube /> } : null,
    talent.facebookProfile ? { href: talent.facebookProfile, label: 'Facebook', icon: <SiFacebook /> } : null,
    talent.website ? { href: talent.website, label: 'Website', icon: <FaGlobe /> } : null,
    talent.email ? { href: `mailto:${talent.email}`, label: 'Email', icon: <FaEnvelope /> } : null,
  ].filter(Boolean)

  const hasFeatured = talent.featuredIn?.length > 0
  const hasPhotos = photos.length > 0
  const showTabs = hasFeatured || hasPhotos

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

        {showTabs && (
          <section className="fashion-talent-tabs-section">
            <TabView className="page-tabview fashion-talent-tabview">
              {hasFeatured && (
                <TabPanel header="Featured In">
                  <div className="discography-grid">
                    {talent.featuredIn.map((credit) => (
                      credit.look ? <LookCard key={credit.id ?? credit.look.id} look={credit.look} /> : null
                    ))}
                  </div>
                </TabPanel>
              )}
              {hasPhotos && (
                <TabPanel header="Photos">
                  <div className="fashion-talent-photos-masonry">
                    {photos.map((photo) => (
                      <div key={photo.pathname || photo.url || photo.previewUrl || photo.altText} className="fashion-talent-photo-item">
                        <Image
                          src={photo.previewUrl || photo.url}
                          alt={photo.altText || talent.name}
                          preview
                          imageClassName="fashion-talent-photo-img"
                        />
                      </div>
                    ))}
                  </div>
                </TabPanel>
              )}
            </TabView>
          </section>
        )}
      </div>
    </div>
  )
}
