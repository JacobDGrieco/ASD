import { useState } from 'react'
import AnnotationPopup from './AnnotationPopup.jsx'
import '../../styles/LyricsView.css'

function LyricLine({ lineText, lineRanges, openAnnotationId, setOpenAnnotationId, allAnnotations }) {
  if (lineText.trim() === '') {
    return <div className="lyrics-view-line lyrics-view-line-blank" aria-hidden="true" />
  }

  if (lineRanges.length === 0) {
    return (
      <div className="lyrics-view-line">
        <span className="lyrics-view-plain">{lineText}</span>
      </div>
    )
  }

  const spans = buildSpans(lineText, lineRanges)

  return (
    <div className="lyrics-view-line-wrap">
      <div className="lyrics-view-line">
        {spans.map((span, i) => {
          if (!span.annotationId) {
            return <span key={i} className="lyrics-view-plain">{span.text}</span>
          }
          const annotation = allAnnotations.find(a => a.id === span.annotationId)
          const isOpen = openAnnotationId === span.annotationId
          return (
            <button
              key={i}
              className={`lyrics-view-annotated ${isOpen ? 'lyrics-view-active' : ''}`}
              onClick={() => setOpenAnnotationId(isOpen ? null : span.annotationId)}
            >
              {span.text}
            </button>
          )
        })}
      </div>
      {openAnnotationId && spans.some(s => s.annotationId === openAnnotationId) && (() => {
        const openAnnotation = allAnnotations.find(a => a.id === openAnnotationId)
        return openAnnotation ? <AnnotationPopup annotation={openAnnotation} className="lyrics-view-popup-overlay" /> : null
      })()}
    </div>
  )
}

function buildSpans(text, lineRanges) {
  const sorted = [...lineRanges].sort((a, b) => a.startChar - b.startChar)
  const spans = []
  let cursor = 0
  for (const range of sorted) {
    const start = Math.max(range.startChar, cursor)
    if (start >= range.endChar) continue
    if (start > cursor) {
      spans.push({ text: text.slice(cursor, start), annotationId: null })
    }
    spans.push({ text: text.slice(start, range.endChar), annotationId: range.annotationId })
    cursor = range.endChar
  }
  if (cursor < text.length) {
    spans.push({ text: text.slice(cursor), annotationId: null })
  }
  return spans
}

export default function LyricsView({ lyric }) {
  const [openAnnotationId, setOpenAnnotationId] = useState(null)

  if (!lyric) return null

  // flatten ranges across all annotations
  const flatRanges = (lyric.annotations ?? []).flatMap(ann =>
    ann.ranges.map(r => ({ startChar: r.startChar, endChar: r.endChar, annotationId: ann.id }))
  ).sort((a, b) => a.startChar - b.startChar)

  const lines = lyric.text.split('\n')
  let lineOffset = 0

  return (
    <section className="lyrics-view-section">
      <div className="lyrics-view-lyrics">
        {lines.map((line, i) => {
          const lineEnd = lineOffset + line.length
          const lineRanges = flatRanges.reduce((ranges, r) => {
            if (r.startChar >= lineEnd || r.endChar <= lineOffset) return ranges
            ranges.push({
              startChar: Math.max(r.startChar - lineOffset, 0),
              endChar: Math.min(r.endChar - lineOffset, line.length),
              annotationId: r.annotationId,
            })
            return ranges
          }, [])
          const result = (
            <LyricLine
              key={i}
              lineText={line}
              lineRanges={lineRanges}
              openAnnotationId={openAnnotationId}
              setOpenAnnotationId={setOpenAnnotationId}
              allAnnotations={lyric.annotations}
            />
          )
          lineOffset += line.length + 1
          return result
        })}
      </div>
    </section>
  )
}
