import type { ReactNode } from 'react'
import { cn } from '@/control-center/approved/lib/cn'

export type NumberSize = 'sm' | 'md' | 'lg' | 'xl'
export type NumberAccent = 'ink' | 'ice' | 'red' | 'warn' | 'ok' | 'muted' | 'onSolid'

const SIZES: Record<NumberSize, string> = {
  sm: 'text-[26px] sm:text-[30px]',
  md: 'text-[34px] sm:text-[42px]',
  lg: 'text-[46px] sm:text-[58px]',
  xl: 'text-[58px] sm:text-[76px]',
}

const ACCENTS: Record<NumberAccent, string> = {
  ink: 'text-ink',
  ice: 'text-ice',
  red: 'text-mt-red',
  warn: 'text-warn',
  ok: 'text-ok',
  muted: 'text-cc-muted',
  onSolid: 'text-canvas',
}

/**
 * Oversized number driven module. Anton, tight leading, tabular figures.
 * Size is the hierarchy tool here. Two number modules at the same size read as
 * equally important, so vary them on purpose.
 *
 * The value is never clipped. Anton overshoots a line box set below 1, so the row
 * stays overflow visible and the figure simply does not wrap.
 */
export function NumberModule({
  label,
  value,
  symbol,
  size = 'md',
  accent = 'ink',
  sub,
  onSolid,
  className,
}: {
  label: string
  value: string
  symbol?: string
  size?: NumberSize
  accent?: NumberAccent
  sub?: ReactNode
  onSolid?: boolean
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div
        className={cn(
          'font-label text-[11px] font-semibold uppercase tracking-[0.18em]',
          onSolid ? 'text-canvas/70' : 'text-cc-muted',
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          'num-safe mt-1.5 flex items-start font-display display-tight tnum',
          SIZES[size],
          ACCENTS[accent],
        )}
      >
        {symbol && (
          <span
            className={cn(
              'mr-0.5 mt-[0.2em] text-[0.44em]',
              onSolid ? 'text-canvas/55' : 'text-cc-muted',
            )}
          >
            {symbol}
          </span>
        )}
        <span>{value}</span>
      </div>
      {sub && (
        <div className={cn('mt-1.5 text-[14px]', onSolid ? 'text-canvas/75' : 'text-cc-muted')}>
          {sub}
        </div>
      )}
    </div>
  )
}
