import { useParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi.js'
import ArtistHero from '../components/artist/ArtistHero.jsx'
import Discography from '../components/artist/Discography.jsx'
import FeaturedOn from '../components/artist/FeaturedOn.jsx'
import AuroraBackground from '../components/shared/AuroraBackground.jsx'

export default function ArtistPage() {
  const { slug } = useParams()
  const { data: artist, loading, error } = useApi(`/api/artists/${slug}`)

  if (!loading && (error || !artist)) return <div className="page not-found"><h1>Artist not found</h1></div>

  return (
    <div className="page aurora-page">
      <AuroraBackground />
      {artist && (
        <div className="aurora-page-content">
          <ArtistHero artist={artist} />
          <Discography albums={artist.albums} artistSlug={artist.slug} />
          <FeaturedOn featuredIn={artist.featuredIn} />
        </div>
      )}
    </div>
  )
}
