import '../../styles/AnnotationPopup.css'

export default function AnnotationPopup({ annotation, className = '' }) {
  return (
    <div className={`annotation-popup-popup ${className}`.trim()}>
      <p className="annotation-popup-text">{annotation.explanation}</p>
    </div>
  )
}
