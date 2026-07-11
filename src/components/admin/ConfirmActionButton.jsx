import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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
  const popoverRef = useRef(null)
  const [popoverStyle, setPopoverStyle] = useState(null)

  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return undefined

    const updatePosition = () => {
      const trigger = rootRef.current
      const popover = popoverRef.current
      if (!trigger || !popover) return

      const triggerRect = trigger.getBoundingClientRect()
      const popoverRect = popover.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const gap = 8

      let left = triggerRect.right - popoverRect.width
      left = Math.max(gap, Math.min(left, viewportWidth - popoverRect.width - gap))

      let top = triggerRect.bottom + gap
      const bottomOverflow = top + popoverRect.height - viewportHeight
      if (bottomOverflow > 0) {
        top = Math.max(gap, triggerRect.top - popoverRect.height - gap)
      }

      setPopoverStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      const target = event.target
      const isInsideTrigger = rootRef.current?.contains(target)
      const isInsidePopover = popoverRef.current?.contains(target)

      if (!isInsideTrigger && !isInsidePopover) {
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
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className="admin-inline-confirm-popover"
          style={popoverStyle ?? undefined}
          role="dialog"
          aria-modal="false"
          aria-label={`Confirm action: ${message}`}
        >
          <p className="admin-inline-confirm-message">{message}</p>
          <div className="admin-inline-confirm-actions">
            <button type="button" onClick={() => setOpen(false)} className="admin-artists-page-ghost-btn">
              {cancelLabel}
            </button>
            <button type="button" onClick={() => void handleConfirm()} className="admin-artists-page-danger-btn">
              {confirmLabel}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
