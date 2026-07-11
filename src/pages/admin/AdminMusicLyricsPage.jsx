import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { FaCheck, FaPlus, FaTrash } from 'react-icons/fa'
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import '../../styles/AdminLyricsPage.css'

export default function AdminMusicLyricsPage() {
  const { songId } = useParams()
  const { state } = useLocation()
  const { token, session } = useAdminAuth()
  const isViewer = session?.role === 'VIEWER'
  const songTitle = state?.songTitle ?? 'Song'
  const auth = { Authorization: `Bearer ${token}` }

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lyricText, setLyricText] = useState('')
  const [annotations, setAnnotations] = useState([])
  const [editingAnnotationIndex, setEditingAnnotationIndex] = useState(null)
  const [hoveredAnnotationIndex, setHoveredAnnotationIndex] = useState(null)
  const [pendingRangeForAnnotationIndex, setPendingRangeForAnnotationIndex] = useState(null)

  const lyricIdRef = useRef(null)
  const preEditRef = useRef({ value: '', selectionStart: 0, selectionEnd: 0 })
  const textareaWrapperRef = useRef(null)
  const textareaRef = useRef(null)

  const resizeLyricTextarea = useCallback((el = textareaRef.current) => {
    if (!el) return
    el.style.height = 'auto'
    const borderHeight = el.offsetHeight - el.clientHeight
    el.style.height = `${el.scrollHeight + borderHeight}px`
  }, [])

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    let ignore = false
    setIsLoading(true)

    fetch(`/api/admin/lyrics?songId=${songId}`, { headers: auth })
      .then((res) => res.json())
      .then((data) => {
        if (ignore) return
        lyricIdRef.current = data.id ?? null
        setLyricText(data.text ?? '')
        setAnnotations(
          (data.annotations ?? []).map((annotation) => ({
            id: annotation.id ?? null,
            explanation: annotation.explanation ?? '',
            ranges: (annotation.ranges ?? []).map((range) => ({
              id: range.id ?? null,
              startChar: range.startChar,
              endChar: range.endChar,
              dirty: false,
            })),
          }))
        )
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [songId, token]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (isLoading) return
    resizeLyricTextarea()
  }, [isLoading, lyricText, resizeLyricTextarea])

  useEffect(() => {
    const wrapper = textareaWrapperRef.current
    if (!wrapper) return

    const resizeObserver = new ResizeObserver(() => resizeLyricTextarea())
    resizeObserver.observe(wrapper)

    return () => resizeObserver.disconnect()
  }, [resizeLyricTextarea])

  // ── Annotation range adjustment ───────────────────────────────────────────

  const adjustAnnotationRanges = useCallback((changeStart, changeEnd, netDelta) => {
    setAnnotations((prev) =>
      prev.map((annotation) => ({
        ...annotation,
        ranges: annotation.ranges.map((range) => {
          if (changeStart >= range.endChar) return range
          if (changeEnd <= range.startChar) {
            return {
              ...range,
              startChar: range.startChar + netDelta,
              endChar: range.endChar + netDelta,
            }
          }
          return { ...range, dirty: true }
        }),
      }))
    )
  }, [])

  // ── Textarea interaction capture ──────────────────────────────────────────

  const handleTextareaInteraction = (e) => {
    preEditRef.current = {
      value: e.target.value,
      selectionStart: e.target.selectionStart,
      selectionEnd: e.target.selectionEnd,
    }
  }

  // ── Lyric text change ─────────────────────────────────────────────────────

  const handleLyricChange = (e) => {
    const newValue = e.target.value
    const { value: oldValue, selectionStart: oldSelStart, selectionEnd: oldSelEnd } = preEditRef.current
    const charsRemoved = oldSelEnd - oldSelStart
    const charsAdded = newValue.length - oldValue.length + charsRemoved
    const changeStart = oldSelStart
    const changeEnd = oldSelStart + charsRemoved
    const netDelta = charsAdded - charsRemoved

    setLyricText(newValue)
    adjustAnnotationRanges(changeStart, changeEnd, netDelta)

    resizeLyricTextarea(e.target)

    preEditRef.current = {
      value: newValue,
      selectionStart: e.target.selectionStart,
      selectionEnd: e.target.selectionEnd,
    }
  }

  // ── Range picking ─────────────────────────────────────────────────────────

  const addRangeFromSelection = useCallback((annotationIndex, selectionStart, selectionEnd) => {
    setAnnotations((prev) =>
      prev.map((annotation, index) => {
        if (index !== annotationIndex) return annotation
        return {
          ...annotation,
          ranges: [
            ...annotation.ranges,
            { id: null, startChar: selectionStart, endChar: selectionEnd, dirty: false },
          ],
        }
      })
    )
  }, [])

  const handleTextareaMouseUp = (e) => {
    if (pendingRangeForAnnotationIndex === null) return
    const { selectionStart, selectionEnd } = e.target
    if (selectionStart === selectionEnd) return
    addRangeFromSelection(pendingRangeForAnnotationIndex, selectionStart, selectionEnd)
    setPendingRangeForAnnotationIndex(null)
  }

  const handleTextareaKeyUp = (e) => {
    if (pendingRangeForAnnotationIndex === null) return
    const { selectionStart, selectionEnd } = e.target
    if (selectionStart === selectionEnd) return
    addRangeFromSelection(pendingRangeForAnnotationIndex, selectionStart, selectionEnd)
    setPendingRangeForAnnotationIndex(null)
  }

  // ── Annotation mutations ──────────────────────────────────────────────────

  const addAnnotation = () => {
    setAnnotations((prev) => {
      setEditingAnnotationIndex(prev.length)
      return [...prev, { id: null, explanation: '', ranges: [] }]
    })
  }

  const updateAnnotationExplanation = (annotationIndex, explanation) => {
    setAnnotations((prev) =>
      prev.map((annotation, index) =>
        index === annotationIndex ? { ...annotation, explanation } : annotation
      )
    )
  }

  const removeRange = (annotationIndex, rangeIndex) => {
    setAnnotations((prev) =>
      prev.map((annotation, index) => {
        if (index !== annotationIndex) return annotation
        return {
          ...annotation,
          ranges: annotation.ranges.filter((_, rIndex) => rIndex !== rangeIndex),
        }
      })
    )
  }

  const deleteAnnotation = async (annotationIndex) => {
    const annotation = annotations[annotationIndex]
    if (annotation.id !== null) {
      const res = await fetch(`/api/admin/annotations?id=${annotation.id}`, {
        method: 'DELETE',
        headers: auth,
      })
      if (!res.ok) {
        alert('Failed to delete annotation.')
        return
      }
    }
    setAnnotations((prev) => prev.filter((_, index) => index !== annotationIndex))
    setEditingAnnotationIndex(null)
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const saveAll = async () => {
    if (isSaving) return

    const hasDirty = annotations.some((annotation) =>
      annotation.ranges.some((range) => range.dirty)
    )
    if (hasDirty) {
      alert('Fix or remove all invalid ranges before saving.')
      return
    }

    setIsSaving(true)
    try {
      // 1. Save lyric text
      const lyricRes = await fetch(`/api/admin/lyrics?songId=${songId}`, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: lyricText }),
      })
      if (!lyricRes.ok) throw new Error('Failed to save lyrics.')
      const lyricData = await lyricRes.json()
      const savedLyricId = lyricData.id
      lyricIdRef.current = savedLyricId

      // 2. Save each annotation
      const updatedAnnotations = await Promise.all(
        annotations.map(async (annotation) => {
          const body = {
            explanation: annotation.explanation,
            ranges: annotation.ranges.map((range) => ({
              startChar: range.startChar,
              endChar: range.endChar,
            })),
          }

          if (annotation.id === null) {
            const res = await fetch('/api/admin/annotations', {
              method: 'POST',
              headers: { ...auth, 'Content-Type': 'application/json' },
              body: JSON.stringify({ songLyricId: savedLyricId, ...body }),
            })
            if (!res.ok) throw new Error('Failed to create annotation.')
            const data = await res.json()
            return {
              id: data.id,
              explanation: data.explanation,
              ranges: (data.ranges ?? []).map((range) => ({
                id: range.id ?? null,
                startChar: range.startChar,
                endChar: range.endChar,
                dirty: false,
              })),
            }
          } else {
            const res = await fetch(`/api/admin/annotations?id=${annotation.id}`, {
              method: 'PUT',
              headers: { ...auth, 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
            if (!res.ok) throw new Error('Failed to update annotation.')
            const data = await res.json()
            return {
              id: data.id,
              explanation: data.explanation,
              ranges: (data.ranges ?? []).map((range) => ({
                id: range.id ?? null,
                startChar: range.startChar,
                endChar: range.endChar,
                dirty: false,
              })),
            }
          }
        })
      )

      setAnnotations((prev) =>
        prev.map((ann, i) => {
          const saved = updatedAnnotations[i]
          if (!saved) return ann
          return {
            ...ann,
            id: saved.id,
            ranges: ann.ranges.map((range, j) => ({
              ...range,
              id: saved.ranges[j]?.id ?? range.id,
              dirty: false,
            })),
          }
        })
      )
    } catch (err) {
      alert(err.message ?? 'An error occurred while saving.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const hasDirtyRanges = annotations.some((annotation) =>
    annotation.ranges.some((range) => range.dirty)
  )

  const isPicking = pendingRangeForAnnotationIndex !== null

  const highlightedAnnotationIndex = hoveredAnnotationIndex ?? editingAnnotationIndex
  const highlightedRanges = highlightedAnnotationIndex !== null
    ? (annotations[highlightedAnnotationIndex]?.ranges ?? []).filter((r) => !r.dirty)
    : []

  const sortedAnnotationEntries = annotations
    .map((annotation, annotationIndex) => ({
      annotation,
      annotationIndex,
      firstStartChar: annotation.ranges.reduce(
        (firstStartChar, range) => (range.dirty ? firstStartChar : Math.min(firstStartChar, range.startChar)),
        Number.POSITIVE_INFINITY
      ),
    }))
    .toSorted((left, right) => {
      const leftStart = Number.isFinite(left.firstStartChar) ? left.firstStartChar : Number.POSITIVE_INFINITY
      const rightStart = Number.isFinite(right.firstStartChar) ? right.firstStartChar : Number.POSITIVE_INFINITY
      if (leftStart !== rightStart) return leftStart - rightStart
      return left.annotationIndex - right.annotationIndex
    })

  function renderBackdrop(text, ranges) {
    if (ranges.length === 0) return text
    const sorted = ranges.toSorted((a, b) => a.startChar - b.startChar)
    const parts = []
    let cursor = 0
    for (const range of sorted) {
      const start = Math.max(range.startChar, cursor)
      if (start >= range.endChar) continue
      if (start > cursor) parts.push(text.slice(cursor, start))
      parts.push(<mark key={`${start}-${range.endChar}`}>{text.slice(start, range.endChar)}</mark>)
      cursor = range.endChar
    }
    if (cursor < text.length) parts.push(text.slice(cursor))
    return parts
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="alp-page">
      <div className="alp-header">
        <div>
          <Link to="/admin/songs" className="alp-back-link">← Songs</Link>
          <h1 className="alp-title">Music — Lyrics</h1>
          <p className="alp-subtitle">{songTitle}</p>
        </div>
        {!isViewer && !isLoading && (
          <div className="alp-header-actions">
            <button type="button" className="alp-save-btn" onClick={saveAll} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save All'}
            </button>
          </div>
        )}
      </div>

      <div className="alp-edit-pane">
        {isLoading ? (
          <div>Loading lyrics...</div>
        ) : (
          <>
            {hasDirtyRanges && (
              <div className="alp-dirty-banner">
                ⚠ Some annotation ranges were affected by your edits. Select the annotation card and re-highlight the text to fix them.
              </div>
            )}

            {isPicking && (
              <div className="alp-picking-banner">
                Highlight text in the lyrics to add a range to this annotation
              </div>
            )}

            <div className="alp-editor-columns">
              <div className="alp-lyrics-panel">
                <div className="alp-lyrics-header">
                  <span>Lyrics</span>
                </div>

                <div className="alp-textarea-wrapper" ref={textareaWrapperRef}>
                  {highlightedRanges.length > 0 && (
                    <div className="alp-textarea-backdrop" aria-hidden="true">
                      {renderBackdrop(lyricText, highlightedRanges)}
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    className={`alp-lyric-textarea${isPicking ? ' alp-lyric-textarea-picking' : ''}${highlightedRanges.length > 0 ? ' alp-lyric-textarea-highlighting' : ''}`}
                    value={lyricText}
                    aria-label="Lyrics text"
                    spellCheck={false}
                    disabled={isViewer}
                    onChange={handleLyricChange}
                    onSelect={handleTextareaInteraction}
                    onKeyDown={handleTextareaInteraction}
                    onMouseDown={handleTextareaInteraction}
                    onMouseUp={handleTextareaMouseUp}
                    onKeyUp={handleTextareaKeyUp}
                  />
                </div>
              </div>

              <div className="alp-annotations-panel">
                <div className="alp-annotations-header">
                  <span>Annotations</span>
                  {!isViewer && (
                    <button
                      type="button"
                      className="alp-annotation-icon-btn alp-add-annotation-btn"
                      onClick={addAnnotation}
                      aria-label="Add annotation"
                      title="Add annotation"
                    >
                      <FaPlus aria-hidden="true" />
                    </button>
                  )}
                </div>

                {sortedAnnotationEntries.map(({ annotation, annotationIndex }) => {
                  const isEditing = editingAnnotationIndex === annotationIndex
                  const hasDirty = annotation.ranges.some((r) => r.dirty)

                  if (!isEditing) {
                    return (
                      <button
                        type="button"
                        key={annotation.id ?? `unsaved-${annotationIndex}`}
                        className={`alp-annotation-card alp-annotation-card-neutral${hasDirty ? ' alp-annotation-card-dirty' : ''}`}
                        onClick={() => setEditingAnnotationIndex(annotationIndex)}
                        onMouseEnter={() => setHoveredAnnotationIndex(annotationIndex)}
                        onMouseLeave={() => setHoveredAnnotationIndex(null)}
                      >
                        <div className="alp-annotation-neutral-ranges">
                          {annotation.ranges.length === 0 ? (
                            <span className="alp-annotation-neutral-empty">No ranges</span>
                          ) : annotation.ranges.map((range, rangeIndex) => (
                            <span
                              key={range.id ?? `range-${annotationIndex}-${rangeIndex}`}
                              className={`alp-range-chip${range.dirty ? ' alp-range-chip-dirty' : ''}`}
                            >
                              {range.dirty
                                ? <span className="alp-range-chip-text">⚠ Re-highlight to fix</span>
                                : <span className="alp-range-chip-text">&ldquo;{lyricText.slice(range.startChar, range.endChar)}&rdquo;</span>
                              }
                            </span>
                          ))}
                        </div>
                        {annotation.explanation && (
                          <p className="alp-annotation-neutral-explanation">{annotation.explanation}</p>
                        )}
                      </button>
                    )
                  }

                  return (
                    <div
                      key={annotation.id ?? `unsaved-${annotationIndex}`}
                      className="alp-annotation-card alp-annotation-card-editing"
                      onMouseEnter={() => setHoveredAnnotationIndex(annotationIndex)}
                      onMouseLeave={() => setHoveredAnnotationIndex(null)}
                    >
                      <div className="alp-annotation-card-edit-header">
                        <div className="alp-annotation-card-actions">
                          <button
                            type="button"
                            className="alp-annotation-icon-btn alp-annotation-done-btn"
                            onClick={() => setEditingAnnotationIndex(null)}
                            aria-label="Done editing annotation"
                            title="Done"
                          >
                            <FaCheck aria-hidden="true" />
                          </button>
                          {!isViewer && (
                            <ConfirmActionButton
                              message="Delete this annotation?"
                              onConfirm={() => deleteAnnotation(annotationIndex)}
                              buttonClassName="alp-annotation-icon-btn alp-annotation-delete-btn"
                              buttonAriaLabel="Delete annotation"
                              buttonTitle="Delete"
                            >
                              <FaTrash aria-hidden="true" />
                            </ConfirmActionButton>
                          )}
                        </div>
                      </div>

                      <div className="alp-ranges-list">
                        <div>Ranges:</div>
                        {annotation.ranges.map((range, rangeIndex) => (
                          <div
                            key={range.id ?? `range-${annotationIndex}-${rangeIndex}`}
                            className={`alp-range-chip${range.dirty ? ' alp-range-chip-dirty' : ''}`}
                          >
                            {range.dirty ? (
                              <span className="alp-range-chip-text">⚠ Re-highlight to fix</span>
                            ) : (
                              <span className="alp-range-chip-text">
                                &ldquo;{lyricText.slice(range.startChar, range.endChar)}&rdquo;
                              </span>
                            )}
                            {!isViewer && (
                              <button
                                type="button"
                                className="alp-range-chip-remove"
                                onClick={() => removeRange(annotationIndex, rangeIndex)}
                                aria-label="Remove range"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}

                        {!isViewer && (
                          <button
                            type="button"
                            className="alp-add-range-btn"
                            onClick={() => setPendingRangeForAnnotationIndex(annotationIndex)}
                          >
                            + Add range
                          </button>
                        )}
                      </div>

                      <textarea
                        className="alp-annotation-explanation"
                        value={annotation.explanation}
                        disabled={isViewer}
                        placeholder="Explanation..."
                        onChange={(e) => updateAnnotationExplanation(annotationIndex, e.target.value)}
                      />

                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
