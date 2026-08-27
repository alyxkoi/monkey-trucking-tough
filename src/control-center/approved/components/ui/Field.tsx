import { Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/control-center/approved/lib/cn'

/** Every input is 48px tall with 16px text so iOS never zooms the page on focus. */
const CONTROL =
  'w-full rounded-xl border border-line bg-raised px-4 text-[16px] text-ink placeholder:text-cc-muted transition-colors focus:border-ice/60 focus:outline-none'

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-2 block font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
      {children}
    </span>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  hint,
  className,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'decimal'
  hint?: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(CONTROL, 'h-12')}
      />
      {hint && <span className="mt-2 block text-[13px] text-cc-muted">{hint}</span>}
    </label>
  )
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(CONTROL, 'resize-y py-3 leading-relaxed')}
      />
    </label>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  renderOption,
  className,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  options: string[]
  /** Maps a stored value to the label shown, for id backed selects. */
  renderOption?: (value: string) => string
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(CONTROL, 'h-12 appearance-none')}
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-raised">
            {renderOption ? renderOption(option) : option}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Load and quantity control. Both targets clear 48px on a phone. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 40,
  suffix,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  suffix?: string
}) {
  const step = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)))

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-raised p-1">
      <button
        type="button"
        aria-label="Less"
        onClick={() => step(-1)}
        disabled={value <= min}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-ink transition-colors hover:bg-[#2A2A30] disabled:opacity-30"
      >
        <Minus className="h-4 w-4" strokeWidth={2.6} />
      </button>
      <span className="min-w-[68px] text-center font-display display-tight tnum text-[24px]">
        {value}
        {suffix && (
          <span className="ml-1 font-label text-[12px] uppercase tracking-[0.12em] text-cc-muted">
            {suffix}
          </span>
        )}
      </span>
      <button
        type="button"
        aria-label="More"
        onClick={() => step(1)}
        disabled={value >= max}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-ink transition-colors hover:bg-[#2A2A30] disabled:opacity-30"
      >
        <Plus className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </div>
  )
}
