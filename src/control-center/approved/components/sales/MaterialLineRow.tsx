import type { ReactNode } from 'react'
import { cn } from '@/control-center/approved/lib/cn'
import { usd } from '@/control-center/approved/lib/format'
import type { MaterialLine } from '@/control-center/approved/state/pricing'

/**
 * One material on a ticket or a quote.
 *
 * The load count leads the row. It used to sit inside a small status pill in the
 * middle of the metadata, which is the wrong place for the number Salvador is
 * actually checking when he scans a ticket: how many loads of what. A full load
 * line gets an icy blue count block, a custom yardage line gets a neutral one, so
 * the two pricing modes are told apart down the left edge before anything is read.
 *
 * The same row is used by the ticket builder, the ticket record and the quote, so
 * a line of material looks like a line of material everywhere in the product.
 */
export function MaterialLineRow({
  line,
  action,
  className,
}: {
  line: MaterialLine
  /** Remove control on the builders, nothing on a finalised record. */
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('row-hover flex items-center gap-4 px-5 py-4', className)}>
      <span
        className={cn(
          'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border',
          line.isFullLoad
            ? 'border-ice/30 bg-ice/[0.1] text-ice'
            : 'border-white/10 bg-white/[0.05] text-cc-muted',
        )}
      >
        <span className="num-safe font-display display-tight tnum text-[19px] leading-none">
          {line.isFullLoad ? (line.loads ?? '—') : line.yards}
        </span>
        <span className="mt-0.5 font-label text-[9px] font-semibold uppercase tracking-[0.12em] opacity-80">
          {line.isFullLoad ? (line.loads === null ? 'legacy' : line.loads === 1 ? 'load' : 'loads') : 'yd'}
        </span>
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-semibold leading-snug text-ink">
          {line.materialName}
        </div>
        <div className="mt-1 font-label text-[12px] font-semibold uppercase tracking-[0.1em] text-cc-muted">
          {line.isFullLoad ? 'Full load' : 'Custom yardage'}
          <span className="px-1.5 text-idle">/</span>
          {line.yards} yd
          <span className="px-1.5 text-idle">/</span>
          {usd(line.rateUsed)} {line.isFullLoad ? 'a load' : 'a yard'}
        </div>
      </div>

      <div className="num-safe shrink-0 font-display display-tight tnum text-[22px]">
        {usd(line.lineTotal)}
      </div>

      {action}
    </div>
  )
}
