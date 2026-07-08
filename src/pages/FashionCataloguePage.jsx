import { useApi } from '../hooks/useApi.js'
import AuroraBackground from '../components/shared/AuroraBackground.jsx'
import FashionCatalogueGrid from '../components/fashion/FashionCatalogueGrid.jsx'
import '../styles/FashionPages.css'

export default function FashionCataloguePage() {
  const { data: items, loading } = useApi('/api/fashion/catalogue')

  if (loading) return null

  return (
    <div className="page aurora-page fashion-page">
      <AuroraBackground />
      <div className="aurora-page-content fashion-page-content">
        <header className="fashion-page-header">
          <h1 className="fashion-page-title">Catalogue</h1>
          <p className="fashion-page-subtitle">Lookbooks, shoppable pieces, and the people behind each shoot.</p>
        </header>

        {items?.length ? (
          <FashionCatalogueGrid items={items} />
        ) : (
          <p className="fashion-page-empty">No looks published yet.</p>
        )}
      </div>
    </div>
  )
}
