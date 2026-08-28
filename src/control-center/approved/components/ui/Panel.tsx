import type { ReactNode } from 'react'
import { cn } from '@/control-center/approved/lib/cn'

/**
 * Surface weight.
 *
 * `default` is the workhorse operational card. `glass` is frosted and reserved
 * for the small number of cards that should feel lifted off the background.
 * `ice` and `warm` are tinted, and exist to group a run of related blocks, not to
 * add color for its own sake.
 */
export type PanelVariant = 'default' | 'glass' | 'ice' | 'warm' | 'ok'

const VARIANTS: Record<PanelVariant, string> = {
  default: 'surface',
  glass: 'surface-glass',
  ice: 'surface-ice',
  warm: 'surface-warm',
  ok: 'surface-ok',
}

/**
 * Neutral operational panel. This is the workhorse surface for dense readable
 * content. It is deliberately quiet so the solid color modules and the oversized
 * number modules can carry the visual weight.
 */
export function Panel({
  title,
  right,
  children,
  footer,
  padded = true,
  variant = 'default',
  className,
  bodyClassName,
}: {
  title?: ReactNode
  right?: ReactNode
  children: ReactNode
  footer?: ReactNode
  padded?: boolean
  variant?: PanelVariant
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={cn('flex flex-col overflow-hidden rounded-panel', VARIANTS[variant], className)}
    >
      {(title || right) && (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 pb-3.5 pt-4">
          {typeof title === 'string' ? <PanelTitle>{title}</PanelTitle> : title}
          {right}
        </header>
      )}
      <div className={cn('flex-1', padded && 'px-5 pb-5', bodyClassName)}>{children}</div>
      {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
    </section>
  )
}

export type TitleTone = 'ice' | 'red' | 'warn' | 'ok' | 'muted'

/**
 * Section label.
 *
 * It reads brighter and wider than the metric labels inside the panel on purpose.
 * Before this the heading and the labels under it were the same size and the same
 * grey, so a heading like Money sat at the same level as Collected and Overdue
 * instead of above them. The small accent square gives the eye a start point down
 * the left edge of a long screen.
 */
export function PanelTitle({
  children,
  tone = 'ice',
  primary = false,
}: {
  children: ReactNode
  tone?: TitleTone
  primary?: boolean
}) {
  if (primary) {
    return (
      <h2 className="font-display text-[24px] uppercase leading-none tracking-[0.035em] text-mt-red sm:text-[26px]">
        {children}
      </h2>
    )
  }

  return (
    <h2 data-tone={tone} className="flex items-center gap-2.5 font-label text-[12px] font-semibold uppercase tracking-[0.2em] text-white">
      <span className="h-3 w-1 shrink-0 rounded-[2px] bg-mt-red" />
      {children}
    </h2>
  )
}

/** Hairline used between rows inside a panel. */
export function RowDivider({ className }: { className?: string }) {
  return <div className={cn('cc-fade-divider h-px', className)} />
}
