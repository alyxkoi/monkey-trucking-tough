import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/control-center/approved/lib/cn'

/**
 * The drill down identity block, and the one pattern for it.
 *
 * Every record the product pushes over a section opens the same way: a floating
 * near black card holding the way back, what kind of record this is, whose record
 * it is, and where it stands. Ticket, Lead, Quote, Job, Customer and Invoice all
 * use this, so the drill down reads as one language rather than six headers that
 * happen to look similar.
 *
 * It is an object on the page, not a strip welded to the top of it: rounded,
 * bordered, lifted, and aligned to the same grid as the cards below it. Full
 * bleed edge to edge was what made it read as chrome.
 *
 * The eyebrow gets a real line of its own. It used to sit hard against the name
 * and read as if the title had swallowed it, which is exactly backwards for the
 * one line that tells you what you are looking at.
 */
export function RecordHeader({
  eyebrow,
  title,
  onBack,
  right,
  className,
}: {
  /** What kind of record, and its number. `Ticket MT1101`, `Invoice 1046`. */
  eyebrow: string
  /** Whose record it is. Usually the customer or company name. */
  title: ReactNode
  onBack?: () => void
  /** Current status, when the record has one worth leading with. */
  right?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'animate-record surface flex items-center gap-3 rounded-block px-4 py-4 sm:gap-4 sm:px-6 sm:py-5',
        className,
      )}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ml-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-cc-muted transition-colors hover:bg-white/[0.07] hover:text-ink"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <div className="font-label text-[11px] font-semibold uppercase leading-none tracking-[0.24em] text-cc-muted sm:text-[12px]">
          {eyebrow}
        </div>
        <div className="mt-2.5 truncate font-display display-tight text-[26px] sm:text-[32px] lg:text-[36px]">
          {title}
        </div>
      </div>

      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  )
}
