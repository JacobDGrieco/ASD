import { useApi } from '../hooks/useApi.js'
import AuroraBackground from '../components/shared/AuroraBackground.jsx'
import TalentCard from '../components/fashion/TalentCard.jsx'
import '../styles/FashionPages.css'

export default function FashionTalentPage() {
  const { data: talent, loading } = useApi('/api/fashion/talent')

  if (loading) return null

  return (
    <div className="page aurora-page fashion-page">
      <AuroraBackground />
      <div className="aurora-page-content fashion-page-content">
        <header className="fashion-page-header">
          <h1 className="fashion-page-title">Talent</h1>
          <p className="fashion-page-subtitle">Models, designers, photographers, and editors signed with ASD Fashion.</p>
        </header>

        {talent?.length ? (
          <div className="fashion-talent-grid">
            {talent.map((person) => <TalentCard key={person.id} talent={person} />)}
          </div>
        ) : (
          <p className="fashion-page-empty">No talent listed yet.</p>
        )}
      </div>
    </div>
  )
}
