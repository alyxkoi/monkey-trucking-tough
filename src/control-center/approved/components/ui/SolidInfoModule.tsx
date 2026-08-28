import type { ReactNode } from 'react'
import { cn } from '@/control-center/approved/lib/cn'

export type SolidTone = 'ice' | 'iceLit' | 'red' | 'warn'

/**
 * Flat colour fields. Urgency and the schedule are strong enough on their own
 * without a gradient laid over them, and a solid red reads as one decisive
 * object rather than a shaded panel.
 *
 * `iceLit` is the single exception, reserved for the calendar anchor.
 */
const TONES: Record<SolidTone, string> = {
  ice: 'field-ice text-canvas',
  iceLit: 'field-ice-lit text-canvas',
  red: 'field-red text-canvas',
  warn: 'field-warn text-canvas',
}

/**
 * Bold solid color module. Used selectively as a visual anchor, never as the
 * default surface.
 *
 * System rule: every bright solid field carries near black text. On acid green that
 * is roughly 11:1, on brand red roughly 5.3:1, both readable outdoors on a phone.
 * Acid green is the schedule, calendar and active-system anchor.
 * Red is genuine urgency only.
 */
export function SolidInfoModule({
  tone = 'ice',
  children,
  className,
}: {
  tone?: SolidTone
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-block overflow-hidden',
        TONES[tone],
        className,
      )}
    >
      {children}
    </section>
  )
}

/** Label styled for use inside a solid color module. */
export function SolidLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'font-label text-[12px] font-semibold uppercase tracking-[0.18em] text-current opacity-80',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Divider for use inside a solid color module. */
export function SolidDivider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-current opacity-[0.15]', className)} />
}
