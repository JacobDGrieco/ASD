import { useState } from 'react'
import AnnotationPopup from './AnnotationPopup.jsx'
import styles from '../../styles/LyricsView.module.css'

function LyricLine({ block, openAnnotationId, setOpenAnnotationId }) {
  const spans = block.annotations.length === 0 ? [] : buildSpans(block.text, block.annotations)
  const openAnnotation = block.annotations.find((a) => a.id === openAnnotationId) ?? null

  if (block.annotations.length === 0) {
    return (
      <div className={styles.line}>
        <span className={styles.plain}>{block.text}</span>
      </div>
    )
  }

  return (
    <div className={styles.line_wrap}>
      <div className={styles.line}>
        {spans.map((span, i) => {
          if (!span.annotation) {
            return <span key={i} className={styles.plain}>{span.text}</span>
          }
          const isOpen = openAnnotationId === span.annotation.id
          return (
            <button
              key={i}
              className={`${styles.annotated} ${isOpen ? styles.active : ''}`}
              onClick={() => setOpenAnnotationId(isOpen ? null : span.annotation.id)}
            >
              {span.text}
            </button>
          )
        })}
      </div>
      {openAnnotation && (
        <AnnotationPopup annotation={openAnnotation} className={styles.popupOverlay} />
      )}
    </div>
  )
}

function buildSpans(text, annotations) {
  const sorted = [...annotations].sort((a, b) => a.startChar - b.startChar)
  const spans = []
  let cursor = 0
  for (const ann of sorted) {
    if (ann.startChar > cursor) {
      spans.push({ text: text.slice(cursor, ann.startChar), annotation: null })
    }
    spans.push({ text: text.slice(ann.startChar, ann.endChar), annotation: ann })
    cursor = ann.endChar
  }
  if (cursor < text.length) {
    spans.push({ text: text.slice(cursor), annotation: null })
  }
  return spans
}

export default function LyricsView({ blocks }) {
  const [openAnnotationId, setOpenAnnotationId] = useState(null)

  return (
    <section className={styles.section}>
      <div className={styles.lyrics}>
        {blocks.map((block) => (
          <LyricLine
            key={block.id}
            block={block}
            openAnnotationId={openAnnotationId}
            setOpenAnnotationId={setOpenAnnotationId}
          />
        ))}
      </div>
    </section>
  )
}
