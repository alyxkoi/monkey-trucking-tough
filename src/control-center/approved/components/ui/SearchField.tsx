import { Search, X } from 'lucide-react'
import { cn } from '@/control-center/approved/lib/cn'

/**
 * Search field. 48px tall, 16px text so iPhone never zooms the page on focus.
 * Selected and focused states use icy blue, the system accent.
 */
export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-12 items-center gap-3 rounded-xl border border-line bg-raised px-4 transition-colors focus-within:border-ice/60',
        className,
      )}
    >
      <Search className="h-5 w-5 shrink-0 text-cc-muted" strokeWidth={2} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-cc-muted focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-cc-muted transition-colors hover:text-ink"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
