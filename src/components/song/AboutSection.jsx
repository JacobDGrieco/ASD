import styles from './AboutSection.module.css'

export default function AboutSection({ meta }) {
  if (!meta?.aboutText) return null
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>About</h2>
      <p className={styles.text}>{meta.aboutText}</p>
    </section>
  )
}
