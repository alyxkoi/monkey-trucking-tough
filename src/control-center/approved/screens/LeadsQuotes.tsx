import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PrimaryButton } from '@/control-center/approved/components/ui/Button'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { SegmentControl } from '@/control-center/approved/components/ui/SegmentControl'
import { EmptyState } from '@/control-center/approved/components/ui/States'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { cn } from '@/control-center/approved/lib/cn'
import { shortAgo, usd } from '@/control-center/approved/lib/format'
import { LEAD_LABEL, LEAD_TONE, QUOTE_LABEL, QUOTE_TONE } from '@/control-center/approved/lib/status'
import { RECORD_NAME_ROW } from '@/control-center/approved/lib/typography'
import { useAppState } from '@/control-center/approved/state/AppState'
import { quoteTotals, type LeadStatus } from '@/control-center/approved/state/salesData'

type Mode = 'leads' | 'quotes'
type Filter = 'ALL' | LeadStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'TALKING', label: 'Talking' },
  { value: 'QUOTED', label: 'Quoted' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
]

const NAME = RECORD_NAME_ROW

export function LeadsQuotes() {
  const [mode, setMode] = useState<Mode>('leads')
  const { setNewLeadSheetOpen } = useAppState()

  return (
    <div className="animate-page space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentControl
          options={[
            { value: 'leads' as Mode, label: 'Leads' },
            { value: 'quotes' as Mode, label: 'Quotes' },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'leads' && (
          <PrimaryButton
            onClick={() => setNewLeadSheetOpen(true)}
            icon={<Plus className="h-5 w-5" strokeWidth={2.6} />}
          >
            New Lead
          </PrimaryButton>
        )}
      </div>

      {/* Keyed so switching mode fades rather than snapping. */}
      <div key={mode} className="animate-swap">
        {mode === 'leads' ? <LeadsInbox /> : <QuotesList />}
      </div>
    </div>
  )
}

/** An opportunity inbox, not a CRM table. */
function LeadsInbox() {
  const [filter, setFilter] = useState<Filter>('ALL')
  const { leads, customerById, setNewLeadSheetOpen } = useAppState()
  const navigate = useNavigate()

  const sorted = [...leads].sort((a, b) => {
    // Urgency is not a status, so it sorts on top without changing the status.
    if (a.needsSalvador !== b.needsSalvador) return a.needsSalvador ? -1 : 1
    return b.lastActivityAt - a.lastActivityAt
  })
  const visible = filter === 'ALL' ? sorted : sorted.filter((lead) => lead.status === filter)

  const countFor = (value: Filter) =>
    value === 'ALL' ? leads.length : leads.filter((lead) => lead.status === value).length

  return (
    <Panel padded={false}>
      <div className="no-scrollbar w-full overflow-x-auto border-b border-white/[0.07] px-5 py-3.5">
        <div className="flex items-center gap-2">
          {FILTERS.map((entry) => {
            const selected = entry.value === filter
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => setFilter(entry.value)}
                className={cn(
                  'row-hover flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 font-label text-[13px] font-semibold uppercase tracking-[0.1em]',
                  selected
                    ? 'field-ice border-transparent text-white'
                    : 'border-white/10 bg-white/[0.05] text-cc-muted hover:bg-white/[0.09] hover:text-ink',
                )}
              >
                {entry.label}
                <span className={cn('tnum', selected ? 'text-white/75' : 'text-idle')}>
                  {countFor(entry.value)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          line="No leads match this filter. New leads land here the moment someone calls, texts, or fills out the form."
        />
      ) : (
        <div className="divide-y divide-white/[0.07]">
          {visible.map((lead) => {
            const customer = customerById(lead.customerId)
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => navigate(`/admin/leads/${lead.id}`)}
                className="row-hover block w-full px-5 py-4 text-left hover:bg-white/[0.04] active:bg-white/[0.07] lg:px-6 lg:py-[18px]"
              >
                {/*
                  On desktop the row spreads into real columns instead of stacking
                  the source under the need and leaving half the width empty.
                */}
                <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_200px_160px] lg:items-center lg:gap-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={NAME}>{customer?.name ?? 'Unknown'}</span>
                      {lead.needsSalvador && (
                        <StatusPill tone="now" size="sm">
                          Salvador needed
                        </StatusPill>
                      )}
                    </div>
                    <div className="mt-1 text-[14px] leading-snug text-cc-muted">{lead.need}</div>
                  </div>

                  <div className="min-w-0 font-label text-[12px] uppercase tracking-[0.12em] text-idle">
                    {lead.source}
                    {lead.campaign && <span className="px-1.5">/</span>}
                    {lead.campaign}
                  </div>

                  <div className="flex items-center gap-3 lg:justify-end">
                    <StatusPill tone={LEAD_TONE[lead.status]} size="sm">
                      {LEAD_LABEL[lead.status]}
                    </StatusPill>
                    <span className="font-label text-[12px] uppercase tracking-[0.1em] text-idle">
                      {shortAgo(lead.lastActivityAt)} ago
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="border-t border-white/[0.07] px-5 py-3">
        <button
          type="button"
          onClick={() => setNewLeadSheetOpen(true)}
          className="row-hover flex h-11 items-center rounded-lg px-2 font-label text-[13px] font-semibold uppercase tracking-[0.12em] text-cc-muted hover:bg-white/[0.05] hover:text-ink"
        >
          Add a lead by hand
        </button>
      </div>
    </Panel>
  )
}

function QuotesList() {
  const { quotes, customerById } = useAppState()
  const navigate = useNavigate()
  const sorted = [...quotes].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <Panel padded={false} title="Quotes">
      {sorted.length === 0 ? (
        <EmptyState
          title="No quotes yet"
          line="Quotes are created from a lead, so the customer and the need carry over."
        />
      ) : (
        <div className="divide-y divide-white/[0.07] border-t border-white/[0.07]">
          {sorted.map((quote) => {
            const customer = customerById(quote.customerId)
            const totals = quoteTotals(quote)
            return (
              <button
                key={quote.id}
                type="button"
                onClick={() => navigate(`/admin/quotes/${quote.id}`)}
                className="row-hover flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.04] active:bg-white/[0.07] lg:gap-6 lg:px-6 lg:py-[18px]"
              >
                <span className="num-safe w-[76px] shrink-0 font-display display-tight text-[20px] text-ice">
                  {quote.number}
                </span>
                <span className="min-w-0 flex-1 lg:grid lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:items-center lg:gap-6">
                  <span className={cn('block truncate', NAME)}>
                    {customer?.name ?? 'Unknown'}
                  </span>
                  <span className="mt-1 block truncate text-[14px] text-cc-muted lg:mt-0">
                    {quote.description}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num-safe block font-display display-tight tnum text-[22px]">
                    {usd(totals.total)}
                  </span>
                  <StatusPill tone={QUOTE_TONE[quote.status]} size="sm" className="mt-1.5">
                    {QUOTE_LABEL[quote.status]}
                  </StatusPill>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
