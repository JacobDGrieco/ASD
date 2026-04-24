import { useState } from 'react'
import AnnotationPopup from './AnnotationPopup.jsx'
import '../../styles/LyricsView.css'

function LyricLine({ block, openAnnotationId, setOpenAnnotationId }) {
  const spans = block.annotations.length === 0 ? [] : buildSpans(block.text, block.annotations)
  const openAnnotation = block.annotations.find((a) => a.id === openAnnotationId) ?? null

  if (block.annotations.length === 0) {
    return (
      <div className="lyrics-view-line">
        <span className="lyrics-view-plain">{block.text}</span>
      </div>
    )
  }

  return (
    <div className="lyrics-view-line-wrap">
      <div className="lyrics-view-line">
        {spans.map((span, i) => {
          if (!span.annotation) {
            return <span key={i} className="lyrics-view-plain">{span.text}</span>
          }
          const isOpen = openAnnotationId === span.annotation.id
          return (
            <button
              key={i}
              className={`lyrics-view-annotated ${isOpen ? 'lyrics-view-active' : ''}`}
              onClick={() => setOpenAnnotationId(isOpen ? null : span.annotation.id)}
            >
              {span.text}
            </button>
          )
        })}
      </div>
      {openAnnotation && (
        <AnnotationPopup annotation={openAnnotation} className="lyrics-view-popup-overlay" />
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
    <section className="lyrics-view-section">
      <div className="lyrics-view-lyrics">
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
