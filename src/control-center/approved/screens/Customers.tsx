import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { SearchField } from '@/control-center/approved/components/ui/SearchField'
import { CustomerInitialAvatar } from '@/control-center/approved/components/ui/CustomerInitialAvatar'
import { EmptyState } from '@/control-center/approved/components/ui/States'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { cn } from '@/control-center/approved/lib/cn'
import { RECORD_NAME_ROW } from '@/control-center/approved/lib/typography'
import { normalizePhone } from '@/control-center/approved/state/salesData'
import { useAppState } from '@/control-center/approved/state/AppState'

type Sort = 'RECENT' | 'OLDEST' | 'AZ' | 'ZA'

const SORTS: { value: Sort; label: string }[] = [
  { value: 'RECENT', label: 'Most recent' },
  { value: 'OLDEST', label: 'Oldest' },
  { value: 'AZ', label: 'A to Z' },
  { value: 'ZA', label: 'Z to A' },
]

export function Customers() {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('RECENT')
  const {
    customers,
    leadsForCustomer,
    jobsForCustomer,
    activitiesForCustomer,
  } = useAppState()
  const navigate = useNavigate()

  const term = query.trim().toLowerCase()
  const digits = normalizePhone(query)

  /**
   * Recent and Oldest run on when something last happened, not when the record
   * was typed in. A customer from two years ago who called this morning is a
   * recent customer.
   */
  const recency = useMemo(() => {
    const map = new Map<string, number>()
    customers.forEach((customer) => {
      const leadTimes = leadsForCustomer(customer.id).map((lead) => lead.lastActivityAt)
      const activityTimes = activitiesForCustomer(customer.id).map((entry) => entry.at)
      map.set(customer.id, Math.max(customer.createdAt, ...leadTimes, ...activityTimes))
    })
    return map
  }, [activitiesForCustomer, customers, leadsForCustomer])

  const visible = useMemo(() => {
    const matched = customers.filter((customer) => {
      if (!term) return true
      const nameHit = customer.name.toLowerCase().includes(term)
      const phoneHit = digits.length >= 3 && normalizePhone(customer.phone).includes(digits)
      const emailHit = customer.email?.toLowerCase().includes(term) ?? false
      return nameHit || phoneHit || emailHit
    })

    const at = (id: string) => recency.get(id) ?? 0
    return [...matched].sort((a, b) => {
      if (sort === 'RECENT') return at(b.id) - at(a.id)
      if (sort === 'OLDEST') return at(a.id) - at(b.id)
      if (sort === 'AZ') return a.name.localeCompare(b.name)
      return b.name.localeCompare(a.name)
    })
  }, [customers, digits, recency, sort, term])

  return (
    <div className="animate-page space-y-5">
      {/* One toolbar. The sort lives beside the search, not in a card of its own. */}
      <div className="flex items-center gap-2.5">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search name, phone or email"
          className="min-w-0 flex-1"
        />
        <SortMenu value={sort} onChange={setSort} />
      </div>

      <Panel padded={false} title="Customers">
        {visible.length === 0 ? (
          <EmptyState
            title="No match"
            line="Nothing here by that name or number. A customer record is created the first time someone becomes a lead."
          />
        ) : (
          <div className="divide-y divide-white/[0.07] border-t border-white/[0.07]">
            {visible.map((customer) => {
              const leads = leadsForCustomer(customer.id)
              const jobs = jobsForCustomer(customer.id).length
              const repeat = leads.length > 1
              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => navigate(`/admin/customers/${customer.id}`)}
                  className="row-hover flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.04] active:bg-white/[0.07] lg:gap-6 lg:px-6 lg:py-[18px]"
                >
                  <CustomerInitialAvatar
                    name={customer.name}
                    className="h-12 w-12 rounded-xl"
                  />

                  <span className="min-w-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)] lg:items-center lg:gap-6">
                    <span className="flex min-w-0 flex-wrap items-center gap-2.5">
                      <span className={RECORD_NAME_ROW}>{customer.name}</span>
                      {repeat && (
                        <StatusPill tone="ok" size="sm">
                          Repeat
                        </StatusPill>
                      )}
                    </span>
                    <span className="mt-1 block font-label text-[13px] uppercase tracking-[0.1em] text-cc-muted lg:mt-0">
                      {customer.phone}
                      <span className="px-1.5 text-idle">/</span>
                      {customer.source}
                    </span>
                  </span>

                  <span className="shrink-0 text-right font-label text-[12px] uppercase tracking-[0.12em] text-idle">
                    {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
                    {jobs > 0 && (
                      <>
                        <span className="px-1.5">/</span>
                        {jobs} {jobs === 1 ? 'job' : 'jobs'}
                      </>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}

/** Compact sort control, sized to sit in the search toolbar. */
function SortMenu({ value, onChange }: { value: Sort; onChange: (value: Sort) => void }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const current = SORTS.find((entry) => entry.value === value) ?? SORTS[0]

  useEffect(() => {
    if (!open) return
    const away = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div ref={boxRef} className="relative z-40 shrink-0">
      <button
        type="button"
        aria-label={`Sort customers: ${current.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className={cn(
          'flex h-12 items-center gap-2 rounded-xl border px-3.5 font-label text-[13px] font-semibold uppercase tracking-[0.1em] transition-colors',
          open
            ? 'border-ice bg-raised text-white'
            : 'border-line bg-raised text-cc-muted hover:bg-white/[0.08] hover:text-ink',
        )}
      >
        <ArrowUpDown className="h-4 w-4 shrink-0" strokeWidth={2.2} />
        {/* The label is the useful part on a wide screen and noise on a phone. */}
        <span className="hidden sm:inline">{current.label}</span>
      </button>

      {/*
        An open menu has to read as an object sitting on top of the page, not as a
        slightly different shade of it. Opaque raised fill, a real border, a hard
        shadow, and a z index above the sticky header and the mobile navigation so
        it is never half covered.
      */}
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-2 w-[200px] overflow-hidden rounded-xl border border-white/25 bg-[#33333C] shadow-[0_24px_48px_-10px_rgba(0,0,0,0.9)] ring-1 ring-black/50"
        >
          {SORTS.map((entry, index) => {
            const selected = entry.value === value
            return (
              <button
                key={entry.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(entry.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex h-12 w-full items-center justify-between gap-3 px-4 text-left font-label text-[13px] font-semibold uppercase tracking-[0.1em] transition-colors',
                  index > 0 && 'border-t border-white/[0.09]',
                  selected
                    ? 'bg-ice text-white'
                    : 'text-ink hover:bg-white/[0.09] active:bg-white/[0.13]',
                )}
              >
                {entry.label}
                {selected && <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
