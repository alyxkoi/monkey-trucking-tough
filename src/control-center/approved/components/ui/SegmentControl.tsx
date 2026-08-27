import { cn } from '@/control-center/approved/lib/cn'

export type SegmentOption<T extends string> = {
  value: T
  label: string
}

/**
 * Filter and mode control. The selected segment uses icy blue, which is the
 * system accent for selected states across the whole product.
 */
export function SegmentControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth,
  className,
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  fullWidth?: boolean
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.05] p-1 backdrop-blur-sm',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg font-label font-semibold uppercase tracking-[0.1em] transition-[background-color,color,box-shadow] duration-200',
              size === 'sm'
                ? 'h-12 px-4 text-[13px] lg:h-9 lg:px-3 lg:text-[12px]'
                : 'h-12 px-4 text-[13px] lg:h-11',
              fullWidth && 'flex-1',
              selected
                ? 'field-ice text-canvas shadow-[0_8px_20px_-12px_rgba(143,203,255,0.8)]'
                : 'text-cc-muted hover:bg-white/[0.06] hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
