import { useEffect, type ReactNode } from 'react'
import { cn } from '@/control-center/approved/lib/cn'
import { useAppState } from '@/control-center/approved/state/AppState'

/**
 * Pinned total bar. Signature component of the Quote builder and the Ticket
 * builder: the running total is always on screen while lines are being added,
 * and the confirming action sits next to it.
 *
 * Pinned to the bottom of the viewport on mobile, inline on desktop.
 */
export function PinnedTotalBar({
  label = 'Total',
  total,
  note,
  action,
  pinned = true,
  className,
}: {
  label?: string
  total: string
  note?: ReactNode
  action?: ReactNode
  pinned?: boolean
  className?: string
}) {
  const { setPinnedBarActive } = useAppState()

  // While this bar is pinned it owns the bottom of the phone screen, so the
  // floating New action steps aside rather than covering the confirming action.
  useEffect(() => {
    if (!pinned) return
    setPinnedBarActive(true)
    return () => setPinnedBarActive(false)
  }, [pinned, setPinnedBarActive])

  return (
    <div
      className={cn(
        'z-30 border-t border-line bg-raised',
        // Fixed above the mobile tab bar, sticky on desktop. Either way the running
        // total and the confirming action never scroll away.
        pinned &&
          'fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+64px)] lg:sticky lg:inset-x-auto lg:bottom-5 lg:rounded-panel lg:border lg:shadow-[0_10px_30px_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 pb-safe lg:py-4">
        <div className="min-w-0">
          <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
            {label}
          </div>
          <div className="font-display display-tight tnum text-[32px] sm:text-[38px]">
            {total}
          </div>
          {note && <div className="mt-0.5 text-[13px] text-cc-muted">{note}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
