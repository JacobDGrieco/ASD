import { useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { useApi } from '../hooks/useApi.js'
import ArtistHero from '../components/artist/ArtistHero.jsx'
import Discography from '../components/artist/Discography.jsx'
import FeaturedOn from '../components/artist/FeaturedOn.jsx'
import AuroraBackground from '../components/shared/AuroraBackground.jsx'
import { useAdminAuth } from '../lib/adminAuth.jsx'
import { usePageTitle } from '../lib/pageTitle.js'
import { isAdminPreviewSession } from '../lib/publicPreview.js'

export default function ArtistPage() {
  const { slug } = useParams()
  const { session, token } = useAdminAuth()
  const adminPreview = isAdminPreviewSession(session, token)
  const { data: artist, loading, error } = useApi(`/api/artists/${slug}`, {
    refreshAtUtcMidnight: true,
  })
  const titleParts = useMemo(() => artist ? [artist.name] : null, [artist])
  usePageTitle(titleParts)

  if (!loading && (error || !artist)) return <div className="page not-found"><h1>Artist not found</h1></div>

  return (
    <div className="page aurora-page">
      <AuroraBackground />
      {artist && (
        <div className="aurora-page-content">
          <ArtistHero artist={artist} />
          <Discography albums={artist.albums} artistSlug={artist.slug} artist={artist} adminPreview={adminPreview} />
          <FeaturedOn featuredIn={artist.featuredIn} adminPreview={adminPreview} />
        </div>
      )}
    </div>
  )
}
