import { useApi } from '../hooks/useApi.js'
import AuroraBackground from '../components/shared/AuroraBackground.jsx'
import LookCard from '../components/fashion/LookCard.jsx'
import '../styles/FashionPages.css'

export default function FashionCataloguePage() {
  const { data: looks, loading } = useApi('/api/fashion/looks')

  if (loading) return null

  return (
    <div className="page aurora-page fashion-page">
      <AuroraBackground />
      <div className="aurora-page-content fashion-page-content">
        <header className="fashion-page-header">
          <h1 className="fashion-page-title">Catalogue</h1>
          <p className="fashion-page-subtitle">Lookbooks, shoppable pieces, and the people behind each shoot.</p>
        </header>

        {looks?.length ? (
          <div className="fashion-talent-grid">
            {looks.map((look) => <LookCard key={look.id} look={look} />)}
          </div>
        ) : (
          <p className="fashion-page-empty">No looks published yet.</p>
        )}
      </div>
    </div>
  )
}
