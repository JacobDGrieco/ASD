import styles from './AnnotationPopup.module.css'

export default function AnnotationPopup({ annotation }) {
  return (
    <div className={styles.popup}>
      <p className={styles.text}>{annotation.explanation}</p>
    </div>
  )
}
