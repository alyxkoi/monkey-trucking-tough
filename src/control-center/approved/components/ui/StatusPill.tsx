import type { ReactNode } from 'react'
import { cn } from '@/control-center/approved/lib/cn'

export type PillTone =
  | 'now'
  | 'today'
  | 'followup'
  | 'ice'
  | 'ok'
  | 'warn'
  | 'idle'
  | 'neutral'
  | 'onSolid'

/**
 * The chip is what carries urgency now that every primary action shares one
 * treatment, so the three priority tones stay the loudest things in the set.
 */
const TONES: Record<PillTone, string> = {
  now: 'bg-mt-red text-canvas',
  today: 'bg-warn text-canvas',
  followup: 'bg-ice/[0.12] text-ice border border-ice/30',
  ice: 'bg-ice text-canvas',
  ok: 'bg-ok/[0.12] text-ok border border-ok/30',
  warn: 'bg-warn/[0.12] text-warn border border-warn/30',
  idle: 'bg-white/[0.05] text-idle border border-white/10',
  neutral: 'bg-white/[0.06] text-cc-muted border border-white/10',
  onSolid: 'bg-canvas text-ink',
}

/**
 * The same status on a solid colour field.
 *
 * A tinted chip works on charcoal and disappears on icy blue. On a colour field
 * every chip becomes a solid fill with a thin near black outline, which is what
 * separates it from the plate underneath. Green on blue was the worst offender
 * and is the reason this exists. Near black sits on green at about 8.6:1; grey
 * takes white instead, because near black on grey does not clear 3:1.
 */
const FIELD_TONES: Record<PillTone, string> = {
  now: 'bg-mt-red text-canvas border border-canvas/50',
  today: 'bg-warn text-canvas border border-canvas/50',
  followup: 'bg-canvas text-ice',
  ice: 'bg-canvas text-ice',
  ok: 'bg-ok text-canvas border border-canvas/50',
  warn: 'bg-warn text-canvas border border-canvas/50',
  idle: 'bg-inactive text-white border border-canvas/50',
  neutral: 'bg-canvas text-ink',
  onSolid: 'bg-canvas text-ink',
}

/** Restrained status pill. Square edges, never a rounded candy chip. */
export function StatusPill({
  tone = 'neutral',
  onField,
  children,
  size = 'md',
  className,
}: {
  tone?: PillTone
  /** Set when the pill sits on a solid colour field such as the calendar. */
  onField?: boolean
  children: ReactNode
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-[6px] font-label font-semibold uppercase tracking-[0.12em] whitespace-nowrap',
        size === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-7 px-2.5 text-[12px]',
        onField ? FIELD_TONES[tone] : TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Small status dot, used where a pill would be too heavy. */
export function StatusDot({
  tone = 'ice',
  pulse,
  className,
}: {
  tone?: 'ice' | 'red' | 'ok' | 'warn' | 'idle'
  pulse?: boolean
  className?: string
}) {
  const color =
    tone === 'ice'
      ? 'bg-ice'
      : tone === 'red'
        ? 'bg-mt-red'
        : tone === 'ok'
          ? 'bg-ok'
          : tone === 'warn'
            ? 'bg-warn'
            : 'bg-idle'
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        color,
        pulse && 'animate-pulse-soft',
        className,
      )}
    />
  )
}
