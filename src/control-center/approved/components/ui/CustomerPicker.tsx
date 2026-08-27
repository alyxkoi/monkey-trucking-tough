import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, UserRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/control-center/approved/lib/cn'
import { PrimaryButton, SecondaryButton } from './Button'
import { FieldLabel, TextField } from './Field'
import { useAppState } from '@/control-center/approved/state/AppState'
import { normalizePhone, type Customer } from '@/control-center/approved/state/salesData'

const MAX_RESULTS = 6

/**
 * How well a customer matches what was typed. Lower is stronger.
 *
 * A phone match beats everything, because that is how Salvador knows people. A
 * name that starts with the term beats one that merely contains it, and email is
 * the weakest signal because it is the field most often missing.
 */
function rank(customer: Customer, term: string, digits: string): number {
  const name = customer.name.toLowerCase()
  const phone = normalizePhone(customer.phone)
  const email = (customer.email ?? '').toLowerCase()

  if (digits.length >= 3 && phone.includes(digits)) return phone.startsWith(digits) ? 0 : 1
  if (name.startsWith(term)) return 2
  if (name.split(/\s+/).some((word) => word.startsWith(term))) return 3
  if (name.includes(term)) return 4
  if (email.length > 0 && email.includes(term)) return 5
  return -1
}

/**
 * Searchable customer selection.
 *
 * The product has to stay comfortable at a few thousand customer records, so no
 * screen preloads the whole list into a dropdown to be scrolled. Nothing is shown
 * until something is typed, results are ranked, and only a handful are rendered
 * at a time.
 *
 * This is the one pattern for choosing an existing customer anywhere in the
 * product. It does not create records itself. `onCreateNew` hands the empty case
 * back to whichever screen owns that workflow, so the duplicate rules stay where
 * they already live.
 */
export function CustomerPicker({
  label = 'Customer',
  value,
  onChange,
  onCreateNew,
  allowCreate,
  createLabel = 'Add a new customer',
  hint,
  placeholder = 'Search customer',
  className,
}: {
  label?: string
  /** Selected customer id, or an empty string. */
  value: string
  onChange: (customerId: string) => void
  /** Hands the empty case back to a screen that owns its own create flow. */
  onCreateNew?: (typed: string) => void
  /**
   * Creates the customer inline, right here, and selects it.
   *
   * For work that was agreed on the phone there is no lead and no quote, only a
   * job to book, so making a customer record first would be a detour through a
   * screen Salvador has no reason to visit.
   */
  allowCreate?: boolean
  createLabel?: string
  hint?: string
  placeholder?: string
  className?: string
}) {
  const { customers, customerById, createCustomer } = useAppState()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftPhone, setDraftPhone] = useState('')
  const [savingCustomer, setSavingCustomer] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = value ? customerById(value) : undefined

  const results = useMemo(() => {
    const clean = term.trim().toLowerCase()
    if (clean.length === 0) return []
    const digits = normalizePhone(term)
    return customers
      .map((customer) => ({ customer, score: rank(customer, clean, digits) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => a.score - b.score || a.customer.name.localeCompare(b.customer.name))
      .map((entry) => entry.customer)
  }, [customers, term])

  const shown = results.slice(0, MAX_RESULTS)

  useEffect(() => setActive(0), [term])

  // Close when the focus or the pointer goes elsewhere.
  useEffect(() => {
    if (!open) return
    const away = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const choose = (customer: Customer) => {
    onChange(customer.id)
    setTerm('')
    setOpen(false)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open || shown.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % shown.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index - 1 + shown.length) % shown.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(shown[active])
    }
  }

  /**
   * Name and phone only. Phone is the key the whole product matches people on,
   * and `createCustomer` returns an existing record rather than making a second
   * one, so this can never quietly create a duplicate.
   */
  if (creating) {
    const canSave = draftName.trim().length > 0 && draftPhone.trim().length > 0
    const finish = async () => {
      if (!canSave || savingCustomer) return
      setSavingCustomer(true)
      try {
        const customer = await createCustomer({ name: draftName, phone: draftPhone })
        onChange(customer.id)
        setCreating(false)
        setDraftName('')
        setDraftPhone('')
        setTerm('')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Customer could not be saved.')
      } finally {
        setSavingCustomer(false)
      }
    }

    return (
      <div className={cn('block', className)}>
        <FieldLabel>{label}</FieldLabel>
        <div className="space-y-3 rounded-xl border border-ice/25 bg-ice/[0.06] p-4">
          <div className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-ice">
            New customer
          </div>
          <TextField label="Name" value={draftName} onChange={setDraftName} placeholder="Who is it" />
          <TextField
            label="Phone"
            value={draftPhone}
            onChange={setDraftPhone}
            inputMode="tel"
            placeholder="(469) 555 0177"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <PrimaryButton size="sm" disabled={!canSave || savingCustomer} onClick={finish}>
              {savingCustomer ? 'Saving' : 'Add customer'}
            </PrimaryButton>
            <SecondaryButton
              size="sm"
              onClick={() => {
                setCreating(false)
                setOpen(true)
              }}
            >
              Back to search
            </SecondaryButton>
          </div>
        </div>
        {hint && <span className="mt-2 block text-[13px] text-cc-muted">{hint}</span>}
      </div>
    )
  }

  if (selected) {
    return (
      <div className={cn('block', className)}>
        <FieldLabel>{label}</FieldLabel>
        <div className="flex items-center gap-3 rounded-xl border border-ice/25 bg-ice/[0.09] px-3 py-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ice/[0.14] font-label text-[15px] font-semibold text-ice">
            {selected.name.charAt(0)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-bold text-ink">
              {selected.name}
            </span>
            <span className="block truncate font-label text-[13px] uppercase tracking-[0.08em] text-cc-muted">
              {selected.phone}
            </span>
          </span>
          <button
            type="button"
            aria-label="Choose a different customer"
            onClick={() => {
              onChange('')
              setTerm('')
              setOpen(true)
              window.setTimeout(() => inputRef.current?.focus(), 0)
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-cc-muted transition-colors hover:bg-white/[0.07] hover:text-ink"
          >
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>
        {hint && <span className="mt-2 block text-[13px] text-cc-muted">{hint}</span>}
      </div>
    )
  }

  return (
    <div ref={boxRef} className={cn('relative block', className)}>
      <FieldLabel>{label}</FieldLabel>

      <div className="flex h-12 items-center gap-2.5 rounded-xl border border-line bg-raised px-3.5 transition-colors focus-within:border-ice/60">
        <Search className="h-5 w-5 shrink-0 text-cc-muted" strokeWidth={2.2} />
        <input
          ref={inputRef}
          value={term}
          role="combobox"
          aria-expanded={open && term.trim().length > 0}
          aria-autocomplete="list"
          placeholder={placeholder}
          onChange={(event) => {
            setTerm(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-cc-muted focus:outline-none"
        />
        {term.length > 0 && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => setTerm('')}
            className="-mr-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-cc-muted transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        )}
      </div>

      {/* Nothing renders until something is typed, so the field stays quiet. */}
      {open && term.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#1b1b20] shadow-lifted">
          {shown.length === 0 ? (
            <div className="p-4">
              <p className="text-[15px] text-cc-muted">No customer found.</p>
              {(onCreateNew || allowCreate) && (
                <button
                  type="button"
                  onClick={() => {
                    if (onCreateNew) {
                      onCreateNew(term.trim())
                      setOpen(false)
                      return
                    }
                    // Carry whatever was typed into the right field, so nothing
                    // has to be typed twice.
                    const digits = normalizePhone(term)
                    setDraftName(digits.length >= 7 ? '' : term.trim())
                    setDraftPhone(digits.length >= 7 ? term.trim() : '')
                    setCreating(true)
                    setOpen(false)
                  }}
                  className="mt-3 flex h-11 items-center rounded-lg px-2 font-label text-[13px] font-semibold uppercase tracking-[0.12em] text-ice transition-colors hover:bg-white/[0.06]"
                >
                  {createLabel}
                </button>
              )}
            </div>
          ) : (
            <ul role="listbox" className="max-h-[292px] overflow-y-auto overscroll-contain">
              {shown.map((customer, index) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(customer)}
                    className={cn(
                      'flex min-h-[58px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors',
                      index === active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.05]',
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ice/[0.1] font-label text-[14px] font-semibold text-ice">
                      {customer.name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-bold text-ink">
                        {customer.name}
                      </span>
                      <span className="block truncate font-label text-[13px] uppercase tracking-[0.08em] text-cc-muted">
                        {customer.phone}
                        {customer.email && (
                          <span className="ml-2 normal-case tracking-normal">
                            {customer.email}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {results.length > MAX_RESULTS && (
                <li className="flex items-center gap-2 border-t border-white/[0.07] px-3.5 py-2.5 font-label text-[12px] uppercase tracking-[0.12em] text-idle">
                  <UserRound className="h-4 w-4" strokeWidth={2.2} />
                  {results.length - MAX_RESULTS} more, keep typing
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {hint && <span className="mt-2 block text-[13px] text-cc-muted">{hint}</span>}
    </div>
  )
}
