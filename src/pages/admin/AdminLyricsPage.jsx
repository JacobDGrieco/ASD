import { useState, useEffect } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import styles from './AdminLyricsPage.module.css'

export default function AdminLyricsPage() {
  const { songId } = useParams()
  const { state } = useLocation()
  const { token } = useAdminAuth()
  const auth = { Authorization: `Bearer ${token}` }

  const [blocks, setBlocks] = useState([])
  const [tab, setTab] = useState('edit')
  const [lyricsText, setLyricsText] = useState('')
  const [selecting, setSelecting] = useState(null)
  const [annotationInput, setAnnotationInput] = useState('')
  const songTitle = state?.songTitle ?? 'Song'

  useEffect(() => {
    fetch(`/api/admin/lyrics?songId=${songId}`, { headers: auth })
      .then((r) => r.json())
      .then((data) => {
        setBlocks(data)
        setLyricsText(data.map((b) => b.text).join('\n'))
      })
  }, [songId, token])

  const saveLyrics = async () => {
    if (!window.confirm('Saving lyrics will delete all existing annotations for this song. Continue?')) return
    const lines = lyricsText.split('\n').filter((l) => l.trim() !== '')
    const res = await fetch(`/api/admin/lyrics?songId=${songId}`, {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks: lines.map((text, i) => ({ text, blockOrder: i })) }),
    })
    const updated = await res.json()
    setBlocks(updated)
    setLyricsText(updated.map((b) => b.text).join('\n'))
  }

  const handleBlockMouseUp = (e, block) => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const container = e.currentTarget
    if (!container.contains(range.commonAncestorContainer)) return
    const startChar = range.startOffset
    const endChar = range.endOffset
    if (startChar >= endChar) return
    setSelecting({ blockId: block.id, startChar, endChar, text: sel.toString() })
    setAnnotationInput('')
  }

  const saveAnnotation = async () => {
    if (!annotationInput.trim() || !selecting) return
    const res = await fetch('/api/admin/annotations', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lyricBlockId: selecting.blockId, startChar: selecting.startChar, endChar: selecting.endChar, explanation: annotationInput }),
    })
    const annotation = await res.json()
    setBlocks((prev) => prev.map((b) => b.id === selecting.blockId ? { ...b, annotations: [...b.annotations, annotation] } : b))
    setSelecting(null)
    setAnnotationInput('')
  }

  const deleteAnnotation = async (annotationId, blockId) => {
    if (!window.confirm('Delete this annotation?')) return
    await fetch(`/api/admin/annotations?id=${annotationId}`, { method: 'DELETE', headers: auth })
    setBlocks((prev) => prev.map((b) => b.id === blockId ? { ...b, annotations: b.annotations.filter((a) => a.id !== annotationId) } : b))
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <Link to="/admin/songs" className={styles.backLink}>← Songs</Link>
          <h1 className={styles.title}>{songTitle}</h1>
        </div>
      </div>

      <div className={styles.tabs}>
        <button onClick={() => setTab('edit')} className={tab === 'edit' ? `${styles.tab} ${styles.activeTab}` : styles.tab}>Edit Lyrics</button>
        <button onClick={() => setTab('annotations')} className={tab === 'annotations' ? `${styles.tab} ${styles.activeTab}` : styles.tab}>Annotations</button>
      </div>

      {tab === 'edit' && (
        <div className={styles.editPane}>
          <p className={styles.hint}>One line per lyric block. Saving will delete all annotations.</p>
          <textarea
            value={lyricsText}
            onChange={(e) => setLyricsText(e.target.value)}
            className={styles.textarea}
            rows={20}
            spellCheck={false}
          />
          <button onClick={saveLyrics} className={styles.primaryBtn}>Save Lyrics</button>
        </div>
      )}

      {tab === 'annotations' && (
        <div className={styles.annotationsPane}>
          <p className={styles.hint}>Select text within a line to add an annotation.</p>
          {blocks.map((block) => (
            <div key={block.id} className={styles.block}>
              <span
                className={styles.blockText}
                onMouseUp={(e) => handleBlockMouseUp(e, block)}
              >
                {block.text}
              </span>

              {selecting?.blockId === block.id && (
                <div className={styles.annotationForm}>
                  <p className={styles.selectedText}>"{selecting.text}"</p>
                  <textarea
                    value={annotationInput}
                    onChange={(e) => setAnnotationInput(e.target.value)}
                    placeholder="Explanation…"
                    className={styles.annotationInput}
                    rows={3}
                    autoFocus
                  />
                  <div className={styles.annotationActions}>
                    <button onClick={saveAnnotation} className={styles.primaryBtn}>Add</button>
                    <button onClick={() => setSelecting(null)} className={styles.ghostBtn}>Cancel</button>
                  </div>
                </div>
              )}

              {block.annotations.length > 0 && (
                <div className={styles.chips}>
                  {block.annotations.map((a) => (
                    <div key={a.id} className={styles.chip}>
                      <span className={styles.chipText}><span>{block.text.slice(a.startChar, a.endChar)}: </span><span>{a.explanation}</span></span>
                      <button onClick={() => deleteAnnotation(a.id, block.id)} className={styles.chipDelete} aria-label="×">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
