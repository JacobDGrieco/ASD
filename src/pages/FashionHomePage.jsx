import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useApi } from '../hooks/useApi.js'
import AuroraBackground from '../components/shared/AuroraBackground.jsx'
import LookCard from '../components/fashion/LookCard.jsx'
import TalentCard from '../components/fashion/TalentCard.jsx'
import '../styles/Discography.css'
import '../styles/FashionPages.css'

export default function FashionHomePage() {
  const { data: looks, loading: looksLoading } = useApi('/api/fashion/looks')
  const { data: talent, loading: talentLoading } = useApi('/api/fashion/talent')

  const featuredLook = looks?.[0] ?? null
  const featuredImage = featuredLook?.images?.[0] ?? null
  const otherLooks = useMemo(() => (looks ?? []).slice(1, 5), [looks])
  const featuredTalent = useMemo(() => (talent ?? []).slice(0, 6), [talent])

  return (
    <div className="page aurora-page fashion-page">
      <AuroraBackground />
      <div className="aurora-page-content fashion-page-content">
        <section className="fashion-home-hero">
          <div className="fashion-home-hero-media">
            {featuredImage ? (
              <img src={featuredImage.previewUrl || featuredImage.url} alt={featuredLook?.title ?? 'Featured look'} className="fashion-home-hero-image" />
            ) : (
              <div className="fashion-home-hero-image-blank" />
            )}
          </div>
          <div className="fashion-home-hero-copy">
            <span className="fashion-home-hero-eyebrow">ASD Fashion</span>
            <h1 className="fashion-home-hero-title">
              {featuredLook ? featuredLook.title : (looksLoading ? '' : 'New looks, new ideas.')}
            </h1>
            {featuredLook?.description && (
              <p className="fashion-home-hero-description">{featuredLook.description}</p>
            )}
            <div className="fashion-home-hero-actions">
              {featuredLook && (
                <Link to={`/fashion/looks/${featuredLook.slug}`} className="fashion-home-hero-link">
                  View the look
                </Link>
              )}
              <Link to="/fashion/catalogue" className="fashion-home-hero-link fashion-home-hero-link-ghost">
                Browse catalogue
              </Link>
            </div>
          </div>
        </section>

        {otherLooks.length > 0 && (
          <section className="discography-section">
            <h2 className="discography-heading">More Looks</h2>
            <div className="discography-grid">
              {otherLooks.map((look) => <LookCard key={look.id} look={look} />)}
            </div>
          </section>
        )}

        {featuredTalent.length > 0 && (
          <section className="discography-section">
            <h2 className="discography-heading">Talent</h2>
            <div className="discography-grid">
              {featuredTalent.map((person) => <TalentCard key={person.id} talent={person} />)}
            </div>
            <Link to="/fashion/talent" className="fashion-home-hero-link fashion-home-hero-link-ghost fashion-home-view-all">
              View all talent
            </Link>
          </section>
        )}

        {!looksLoading && !talentLoading && !looks?.length && !talent?.length && (
          <p className="fashion-page-empty">Fashion content coming soon.</p>
        )}
      </div>
    </div>
  )
}
