import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/control-center/approved/lib/cn'

/**
 * Bottom sheet on a phone, centered dialog on desktop.
 * Solid panel surface, no glass, no blur. The scrim is the only transparency.
 */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="cc-sheet-portal fixed inset-0 z-50 flex items-end justify-center font-control-body text-ink [color-scheme:dark] sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-black/70"
      />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'animate-sheet relative flex max-h-[88vh] w-full flex-col border border-line bg-panel',
          'rounded-t-block sm:max-w-lg sm:rounded-block',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {eyebrow && (
              <div className="font-label text-[12px] font-semibold uppercase tracking-[0.18em] text-cc-muted">
                {eyebrow}
              </div>
            )}
            <h2 className="font-display display-tight text-[26px] text-ink">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-cc-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div className="border-t border-line px-5 py-4 pb-safe sm:pb-4">{footer}</div>
        )}
        {!footer && <div className="pb-safe sm:pb-0" />}
      </div>
    </div>,
    document.body,
  )
}
