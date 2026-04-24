import styles from '../../styles/AnnotationPopup.module.css'

export default function AnnotationPopup({ annotation, className = '' }) {
  return (
    <div className={`${styles.popup} ${className}`.trim()}>
      <p className={styles.text}>{annotation.explanation}</p>
    </div>
  )
}
