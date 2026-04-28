import { useEffect, useRef, useState } from 'react'

export default function ConfirmActionButton({
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  buttonClassName = '',
  buttonAriaLabel,
  buttonTitle,
  children,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleConfirm = async () => {
    await onConfirm()
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="admin-inline-confirm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={buttonClassName}
        aria-label={buttonAriaLabel}
        title={buttonTitle}
      >
        {children}
      </button>
      {open && (
        <div className="admin-inline-confirm-popover" role="dialog" aria-modal="false">
          <p className="admin-inline-confirm-message">{message}</p>
          <div className="admin-inline-confirm-actions">
            <button type="button" onClick={() => setOpen(false)} className="admin-artists-page-ghost-btn">
              {cancelLabel}
            </button>
            <button type="button" onClick={() => void handleConfirm()} className="admin-artists-page-danger-btn">
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
