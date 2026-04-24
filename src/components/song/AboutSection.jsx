import '../../styles/AboutSection.css'

export default function AboutSection({ meta }) {
  if (!meta?.aboutText) return null
  return (
    <section className="about-section-section">
      <h2 className="about-section-heading">About</h2>
      <p className="about-section-text">{meta.aboutText}</p>
    </section>
  )
}
