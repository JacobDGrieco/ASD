import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { useEffect, useRef, useState } from 'react'
import '../../styles/RichTextEditor.css'

function countHtmlOccurrences(html, pattern) {
  return (String(html ?? '').match(pattern) ?? []).length
}

function bodyLimitMessage(html, { maxLinks, maxImages }) {
  const imageCount = countHtmlOccurrences(html, /<img\b/gi)
  const linkCount = countHtmlOccurrences(html, /<a\b[^>]*href\s*=/gi)

  if (imageCount > maxImages) return `Only ${maxImages} image is allowed in the body.`
  if (linkCount > maxLinks) return `Only ${maxLinks} links are allowed in the body.`
  return ''
}

export default function RichTextEditor({ value, onChange, disabled, maxLinks = 3, maxImages = 1 }) {
  const lastValidContentRef = useRef(value || '')
  const [limitError, setLimitError] = useState('')
  const [linkMenuOpen, setLinkMenuOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value || '',
    editable: !disabled,
    onUpdate({ editor }) {
      const html = editor.getHTML()
      const error = bodyLimitMessage(html, { maxLinks, maxImages })
      if (error) {
        setLimitError(error)
        editor.commands.setContent(lastValidContentRef.current || '', false)
        return
      }

      lastValidContentRef.current = html
      setLimitError('')
      onChange(html)
    },
  })

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '', false)
    }
    lastValidContentRef.current = value || ''
  }, [value, editor])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  if (!editor) return null

  const openLinkMenu = () => {
    const prev = editor.getAttributes('link').href
    const currentHtml = editor.getHTML()
    const currentLinks = countHtmlOccurrences(currentHtml, /<a\b[^>]*href\s*=/gi)
    if (!editor.isActive('link') && currentLinks >= maxLinks) {
      setLimitError(`Only ${maxLinks} links are allowed in the body.`)
      return
    }
    setLinkValue(prev || 'https://')
    setLinkMenuOpen(true)
  }

  const applyLink = () => {
    const url = linkValue.trim()
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setLimitError('')
      setLinkMenuOpen(false)
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    setLinkMenuOpen(false)
  }

  return (
    <div className={`rte-wrapper${disabled ? ' rte-disabled' : ''}`}>
      {!disabled && (
        <div className="rte-toolbar-wrap">
          <div className="rte-toolbar">
          <button
            type="button"
            className={`rte-btn${editor.isActive('bold') ? ' rte-btn-active' : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >B</button>
          <button
            type="button"
            className={`rte-btn rte-italic${editor.isActive('italic') ? ' rte-btn-active' : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >I</button>
          <button
            type="button"
            className={`rte-btn${editor.isActive('link') ? ' rte-btn-active' : ''}`}
            onClick={openLinkMenu}
          >Link</button>
          <button
            type="button"
            className={`rte-btn${editor.isActive('bulletList') ? ' rte-btn-active' : ''}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >• List</button>
        </div>
          {linkMenuOpen && (
            <div className="rte-link-row">
              <input
                type="url"
                className="rte-link-input"
                value={linkValue}
                onChange={(event) => setLinkValue(event.target.value)}
                placeholder="https://example.com"
              />
              <button type="button" className="rte-btn rte-link-action" onClick={applyLink}>Apply</button>
              <button
                type="button"
                className="rte-btn rte-link-action"
                onClick={() => {
                  setLinkMenuOpen(false)
                  setLinkValue('')
                }}
              >Cancel</button>
            </div>
          )}
        </div>
      )}
      <EditorContent editor={editor} className="rte-content" />
      {!disabled && (
        <div className="rte-meta">
          <span className="rte-limit-note">Up to {maxImages} image and {maxLinks} links.</span>
          {limitError ? <span className="rte-limit-error">{limitError}</span> : null}
        </div>
      )}
    </div>
  )
}
