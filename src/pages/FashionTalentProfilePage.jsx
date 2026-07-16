import { useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { Image } from 'primereact/image'
import { TabPanel, TabView } from 'primereact/tabview'
import { useApi } from '../hooks/useApi.js'
import AuroraBackground from '../components/shared/AuroraBackground.jsx'
import ArtworkGallery from '../components/shared/ArtworkGallery.jsx'
import ProfileLinkIcon from '../components/shared/ProfileLinkIcon.jsx'
import LookCard from '../components/fashion/LookCard.jsx'
import { usePageTitle } from '../lib/pageTitle.js'
import { PROFILE_LINK_PLATFORM_LABELS, hrefForProfileLink, normalizeProfileLinks } from '../lib/profileLinks.js'
import '../styles/Discography.css'
import '../styles/SongHeader.css'
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
  const apiUrl = `/api/fashion/talent/${slug}`
  const { data: talent, loading, error } = useApi(apiUrl)
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
  const contactLinks = normalizeProfileLinks(talent.links)

  const hasFeatured = talent.featuredIn?.length > 0
  const hasPhotos = photos.length > 0
  const showTabs = hasFeatured || hasPhotos

  return (
    <div className="page aurora-page fashion-page">
      <AuroraBackground />
      <div className="aurora-page-content fashion-page-content">
        <section className={`fashion-talent-hero ${talent.isVisible === false ? 'fashion-talent-hero-hidden' : ''}`.trim()}>
          <div className="fashion-talent-hero-portrait-wrap">
            <div className="fashion-talent-hero-portrait-frame">
              <ArtworkGallery images={talent.images} title={talent.name} buttonLabel={`View ${talent.name} images`} />
              {image && <img src={image.previewUrl || image.url} alt={talent.name} className="fashion-talent-hero-portrait" />}
            </div>
            {contactLinks.length > 0 && (
              <div className="fashion-talent-hero-links">
                {contactLinks.map((link) => {
                  const label = PROFILE_LINK_PLATFORM_LABELS[link.platform] ?? 'Link'
                  return (
                  <a
                    key={link.id}
                    href={hrefForProfileLink(link)}
                    target={link.platform === 'email' ? undefined : '_blank'}
                    rel={link.platform === 'email' ? undefined : 'noopener noreferrer'}
                    aria-label={label}
                    title={label}
                  >
                    <ProfileLinkIcon platform={link.platform} />
                  </a>
                  )
                })}
              </div>
            )}
          </div>
          <div className="fashion-talent-hero-info">
            {talent.isVisible === false && <span className="song-header-visibility-badge">Hidden in public view</span>}
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
