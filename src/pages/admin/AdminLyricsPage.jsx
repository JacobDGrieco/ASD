import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import '../../styles/AdminLyricsPage.css'

function createRow(block = null) {
  return { id: block?.id ?? null, text: block?.text ?? '' }
}

function createAnnotationRow(block = null) {
  const firstAnnotation = block?.annotations?.[0] ?? null
  return { id: firstAnnotation?.id ?? null, text: firstAnnotation?.explanation ?? '' }
}

export default function AdminLyricsPage() {
  const { songId } = useParams()
  const { state } = useLocation()
  const { token } = useAdminAuth()
  const auth = { Authorization: `Bearer ${token}` }

  const [blocks, setBlocks] = useState([])
  const [lyricsRows, setLyricsRows] = useState([createRow()])
  const [annotationRows, setAnnotationRows] = useState([createAnnotationRow()])
  const [selectedRows, setSelectedRows] = useState([])
  const [editingAnnotationIndex, setEditingAnnotationIndex] = useState(null)
  const songTitle = state?.songTitle ?? 'Song'
  const lyricRowRefs = useRef([])
  const annotationRowRefs = useRef([])
  const pendingFocus = useRef(null)
  const selectionAnchor = useRef(null)

  useEffect(() => {
    fetch(`/api/admin/lyrics?songId=${songId}`, { headers: auth })
      .then((response) => response.json())
      .then((data) => {
        setBlocks(data)
        setLyricsRows(data.length ? data.map((block) => createRow(block)) : [createRow()])
        setAnnotationRows(data.length ? data.map((block) => createAnnotationRow(block)) : [createAnnotationRow()])
        setSelectedRows([])
        setEditingAnnotationIndex(null)
      })
  }, [songId, token])

  useEffect(() => {
    if (!pendingFocus.current) return
    const { column = 'lyrics', index, cursor = 'end' } = pendingFocus.current
    const refs = column === 'annotations' ? annotationRowRefs.current : lyricRowRefs.current
    const input = refs[index]
    if (!input) return
    input.focus()
    const pos = cursor === 'start' ? 0 : input.value.length
    input.setSelectionRange(pos, pos)
    pendingFocus.current = null
  }, [annotationRows, lyricsRows])

  const annotationsByBlockId = useMemo(
    () => new Map(blocks.map((block) => [block.id, block.annotations])),
    [blocks]
  )

  const updateLyricsRow = (index, text) => {
    setLyricsRows((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, text } : row))
  }

  const updateAnnotationRow = (index, text) => {
    setAnnotationRows((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, text } : row))
  }

  const insertLyricsRowAfter = (index) => {
    setLyricsRows((prev) => {
      const next = [...prev]
      next.splice(index + 1, 0, createRow())
      return next
    })
    setAnnotationRows((prev) => {
      const next = [...prev]
      next.splice(index + 1, 0, createAnnotationRow())
      return next
    })
    pendingFocus.current = { column: 'lyrics', index: index + 1, cursor: 'start' }
  }

  const removeLyricsRowAt = (index) => {
    setLyricsRows((prev) => {
      if (prev.length === 1) return [createRow()]
      const next = prev.filter((_, rowIndex) => rowIndex !== index)
      return next.length ? next : [createRow()]
    })
    setAnnotationRows((prev) => {
      if (prev.length === 1) return [createAnnotationRow()]
      const next = prev.filter((_, rowIndex) => rowIndex !== index)
      return next.length ? next : [createAnnotationRow()]
    })
    setSelectedRows([])
    selectionAnchor.current = null
    pendingFocus.current = { column: 'lyrics', index: Math.max(index - 1, 0), cursor: 'end' }
  }

  const deleteSelectedRows = () => {
    if (!selectedRows.length) return
    const selectedSet = new Set(selectedRows)
    setLyricsRows((prev) => {
      const next = prev.filter((_, index) => !selectedSet.has(index))
      return next.length ? next : [createRow()]
    })
    setAnnotationRows((prev) => {
      const next = prev.filter((_, index) => !selectedSet.has(index))
      return next.length ? next : [createAnnotationRow()]
    })
    pendingFocus.current = { column: 'lyrics', index: Math.max(Math.min(...selectedRows) - 1, 0), cursor: 'end' }
    setSelectedRows([])
    selectionAnchor.current = null
  }

  const focusAdjacentRow = (column, index, direction) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= lyricsRows.length) return
    pendingFocus.current = { column, index: nextIndex, cursor: 'end' }
    setLyricsRows((prev) => [...prev])
  }

  const handleRowKeyDown = (column, event, index) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedRows.length > 0) {
      event.preventDefault()
      deleteSelectedRows()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (column === 'lyrics') insertLyricsRowAfter(index)
      return
    }

    if (column === 'lyrics' && event.key === 'Backspace' && lyricsRows[index].text === '') {
      event.preventDefault()
      removeLyricsRowAt(index)
      return
    }

    if (column === 'annotations' && event.key === 'Escape') {
      event.preventDefault()
      setEditingAnnotationIndex(null)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusAdjacentRow(column, index, -1)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusAdjacentRow(column, index, 1)
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      const input = event.currentTarget
      const start = input.selectionStart ?? input.value.length
      const end = input.selectionEnd ?? input.value.length
      const currentText = column === 'annotations' ? annotationRows[index].text : lyricsRows[index].text
      const nextText = `${currentText.slice(0, start)}  ${currentText.slice(end)}`
      if (column === 'annotations') {
        updateAnnotationRow(index, nextText)
      } else {
        updateLyricsRow(index, nextText)
      }
      requestAnimationFrame(() => {
        const refs = column === 'annotations' ? annotationRowRefs.current : lyricRowRefs.current
        const target = refs[index]
        if (target) {
          target.focus()
          const pos = start + 2
          target.setSelectionRange(pos, pos)
        }
      })
    }
  }

  const handleRowPaste = (column, event, index) => {
    const pastedText = event.clipboardData.getData('text')
    if (!pastedText.includes('\n')) return

    event.preventDefault()
    const lines = pastedText.replace(/\r/g, '').split('\n')
    const input = event.currentTarget
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? input.value.length
    const currentRows = column === 'annotations' ? annotationRows : lyricsRows
    const before = currentRows[index].text.slice(0, start)
    const after = currentRows[index].text.slice(end)

    const insertedRows = lines.map((line, lineIndex) => {
      const nextText = lineIndex === 0
        ? `${before}${line}`
        : lineIndex === lines.length - 1
          ? `${line}${after}`
          : line

      return column === 'annotations'
        ? { ...(lineIndex === 0 ? currentRows[index] : createAnnotationRow()), text: nextText }
        : lineIndex === 0
          ? { ...currentRows[index], text: nextText }
          : createRow({ text: nextText })
    })

    if (column === 'annotations') {
      setAnnotationRows((prev) => {
        const next = [...prev]
        next.splice(index, 1, ...insertedRows)
        while (next.length < lyricsRows.length) next.push(createAnnotationRow())
        return next.slice(0, lyricsRows.length)
      })
    } else {
      setLyricsRows((prev) => {
        const next = [...prev]
        next.splice(index, 1, ...insertedRows)
        return next
      })
      setAnnotationRows((prev) => {
        const next = [...prev]
        next.splice(index + 1, 0, ...Array.from({ length: lines.length - 1 }, () => createAnnotationRow()))
        return next
      })
    }

    setSelectedRows([])
    pendingFocus.current = { column, index: index + lines.length - 1, cursor: 'end' }
  }

  const handleRowSelection = (index, event) => {
    if (event.shiftKey && selectionAnchor.current !== null) {
      const start = Math.min(selectionAnchor.current, index)
      const end = Math.max(selectionAnchor.current, index)
      setSelectedRows(Array.from({ length: end - start + 1 }, (_, offset) => start + offset))
      return
    }

    if (event.metaKey || event.ctrlKey) {
      setSelectedRows((prev) => prev.includes(index) ? prev.filter((value) => value !== index) : [...prev, index].sort((left, right) => left - right))
      selectionAnchor.current = index
      return
    }

    setSelectedRows([index])
    selectionAnchor.current = index
  }

  const saveLyrics = async () => {
    const lyricPayload = lyricsRows
      .filter((row) => row.text.trim() !== '')
      .map((row, index) => ({ id: row.id, text: row.text, blockOrder: index }))

    const response = await fetch(`/api/admin/lyrics?songId=${songId}`, {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks: lyricPayload }),
    })
    const updatedBlocks = await response.json()

    await Promise.all(updatedBlocks.map((block, index) => {
      const annotationText = annotationRows[index]?.text?.trim() ?? ''
      const existingAnnotations = block.annotations ?? []
      const [primaryAnnotation, ...extraAnnotations] = existingAnnotations

      if (!annotationText) {
        return Promise.all(extraAnnotations.concat(primaryAnnotation ?? []).filter(Boolean).map((annotation) => fetch(`/api/admin/annotations?id=${annotation.id}`, {
          method: 'DELETE',
          headers: auth,
        })))
      }

      const endChar = block.text.length
      const saveRequest = primaryAnnotation
        ? fetch(`/api/admin/annotations?id=${primaryAnnotation.id}`, {
            method: 'PUT',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ startChar: 0, endChar, explanation: annotationText }),
          })
        : fetch('/api/admin/annotations', {
            method: 'POST',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ lyricBlockId: block.id, startChar: 0, endChar, explanation: annotationText }),
          })

      return Promise.all([
        saveRequest,
        ...extraAnnotations.map((annotation) => fetch(`/api/admin/annotations?id=${annotation.id}`, {
          method: 'DELETE',
          headers: auth,
        })),
      ])
    }))

    const refreshedBlocks = await fetch(`/api/admin/lyrics?songId=${songId}`, { headers: auth }).then((res) => res.json())
    setBlocks(refreshedBlocks)
    setLyricsRows(refreshedBlocks.length ? refreshedBlocks.map((block) => createRow(block)) : [createRow()])
    setAnnotationRows(refreshedBlocks.length ? refreshedBlocks.map((block) => createAnnotationRow(block)) : [createAnnotationRow()])
    setSelectedRows([])
    selectionAnchor.current = null
  }

  return (
    <div>
      <div className="admin-lyrics-page-header">
        <div>
          <Link to="/admin/songs" className="admin-lyrics-page-back-link">← Songs</Link>
          <h1 className="admin-lyrics-page-title">{songTitle}</h1>
        </div>
      </div>

      <div className="admin-lyrics-page-edit-pane">
        <p className="admin-lyrics-page-hint">Enter creates a new lyric line. Backspace on an empty lyric line removes it. Arrow keys move between lines. Tab inserts spaces. Annotations are edited directly per matching row.</p>
        {selectedRows.length > 0 && (
          <div className="admin-lyrics-page-bulk-actions">
            <span className="admin-lyrics-page-selection-summary">{selectedRows.length} line{selectedRows.length === 1 ? '' : 's'} selected</span>
            <button onClick={deleteSelectedRows} className="admin-lyrics-page-ghost-btn">Delete Selected</button>
          </div>
        )}

        <div className="admin-lyrics-page-editor-grid">
          <section className="admin-lyrics-page-editor-panel">
            <div className="admin-lyrics-page-editor-label">Lyrics</div>
            <div className="admin-lyrics-page-editor-surface">
              {lyricsRows.map((row, index) => (
                <div key={row.id ?? `row-${index}`} className={`admin-lyrics-page-editor-row ${selectedRows.includes(index) ? 'admin-lyrics-page-selected-row' : ''}`.trim()}>
                  <button type="button" className={`admin-lyrics-page-row-number ${selectedRows.includes(index) ? 'admin-lyrics-page-selected-number' : ''}`.trim()} onClick={(event) => handleRowSelection(index, event)} aria-label={`Select lyric line ${index + 1}`}>{index + 1}</button>
                  <textarea
                    ref={(element) => {
                      lyricRowRefs.current[index] = element
                    }}
                    value={row.text}
                    onChange={(event) => updateLyricsRow(index, event.target.value)}
                    onKeyDown={(event) => handleRowKeyDown('lyrics', event, index)}
                    onPaste={(event) => handleRowPaste('lyrics', event, index)}
                    className={`admin-lyrics-page-line-input admin-lyrics-page-lyric-input`}
                    rows={1}
                    spellCheck={false}
                    aria-label={`Lyric line ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="admin-lyrics-page-editor-panel">
            <div className="admin-lyrics-page-editor-label">Annotations</div>
            <div className="admin-lyrics-page-editor-surface">
              {lyricsRows.map((row, index) => {
                return (
                  <div key={`annotation-${row.id ?? index}`} className="admin-lyrics-page-annotation-editor-row">
                    <div className="admin-lyrics-page-row-number">{index + 1}</div>
                    <div className="admin-lyrics-page-annotation-editor-cell">
                      <button
                        type="button"
                        className={`admin-lyrics-page-line-input admin-lyrics-page-annotation-preview`}
                        onClick={() => {
                          setEditingAnnotationIndex(index)
                          pendingFocus.current = { column: 'annotations', index, cursor: 'end' }
                          setAnnotationRows((prev) => [...prev])
                        }}
                        title={annotationRows[index]?.text ?? ''}
                        aria-label={`Annotation line ${index + 1}`}
                      >
                        {annotationRows[index]?.text ?? ''}
                      </button>
                      {editingAnnotationIndex === index && (
                        <div className="admin-lyrics-page-annotation-overlay">
                          <textarea
                            ref={(element) => {
                              annotationRowRefs.current[index] = element
                            }}
                            value={annotationRows[index]?.text ?? ''}
                            onChange={(event) => updateAnnotationRow(index, event.target.value)}
                            onKeyDown={(event) => handleRowKeyDown('annotations', event, index)}
                            onBlur={() => setEditingAnnotationIndex(null)}
                            onPaste={(event) => handleRowPaste('annotations', event, index)}
                            placeholder="Annotation for this line..."
                            className={`admin-lyrics-page-line-input admin-lyrics-page-annotation-textarea`}
                            rows={4}
                            spellCheck={false}
                            aria-label={`Annotation line ${index + 1}`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <button onClick={saveLyrics} className="admin-lyrics-page-primary-btn">Save Lyrics</button>
      </div>
    </div>
  )
}
