import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PrimaryButton } from '@/control-center/approved/components/ui/Button'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { SearchField } from '@/control-center/approved/components/ui/SearchField'
import { SegmentControl } from '@/control-center/approved/components/ui/SegmentControl'
import { EmptyState } from '@/control-center/approved/components/ui/States'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { SyncBanner } from '@/control-center/approved/components/ui/SyncState'
import { cn } from '@/control-center/approved/lib/cn'
import { usd } from '@/control-center/approved/lib/format'
import { useAppState } from '@/control-center/approved/state/AppState'
import { materialSummary, ticketTotals } from '@/control-center/approved/state/ticketsData'

type Range = 'TODAY' | 'MONTH' | 'ALL'

const RANGES: { value: Range; label: string }[] = [
  { value: 'TODAY', label: 'Today' },
  { value: 'MONTH', label: 'This Month' },
  { value: 'ALL', label: 'All' },
]

function stamp(at: number): string {
  const date = new Date(at)
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toUpperCase()}`
}

export function Tickets() {
  const [query, setQuery] = useState('')
  const [range, setRange] = useState<Range>('MONTH')
  const { tickets, customerById, jobById, sync, queued } = useAppState()
  const navigate = useNavigate()

  const term = query.trim().toLowerCase()
  const now = new Date()

  const visible = tickets
    .filter((ticket) => {
      const created = new Date(ticket.createdAt)
      if (range === 'TODAY') return created.toDateString() === now.toDateString()
      if (range === 'MONTH')
        return (
          created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
        )
      return true
    })
    .filter((ticket) => {
      if (!term) return true
      const customer = customerById(ticket.customerId)?.name.toLowerCase() ?? ''
      return (
        (ticket.number ?? '').toLowerCase().includes(term) ||
        customer.includes(term) ||
        ticket.address.toLowerCase().includes(term)
      )
    })
    .sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="space-y-5">
      <SyncBanner status={sync} queued={queued} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentControl options={RANGES} value={range} onChange={setRange} />
        <PrimaryButton
          onClick={() => navigate('/admin/tickets/new')}
          icon={<Plus className="h-5 w-5" strokeWidth={2.6} />}
        >
          New Ticket
        </PrimaryButton>
      </div>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search ticket, customer, address"
      />

      <Panel padded={false} title={`${visible.length} tickets`}>
        {visible.length === 0 ? (
          <div className="border-t border-line">
            <EmptyState
              title="No tickets here"
              line="A ticket is the record of material and delivery going out. Create one from a job or on its own."
              action={
                <PrimaryButton size="sm" onClick={() => navigate('/admin/tickets/new')}>
                  New Ticket
                </PrimaryButton>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-line border-t border-line">
            {visible.map((ticket) => {
              const customer = customerById(ticket.customerId)
              const job = ticket.jobId ? jobById(ticket.jobId) : undefined
              const totals = ticketTotals(ticket)
              const voided = ticket.status === 'VOID'
              const pending = ticket.sync === 'PENDING'

              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                  className={cn(
                    'row-hover flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-white/[0.04] active:bg-raised',
                    voided && 'opacity-55',
                  )}
                >
                  <span className="w-[80px] shrink-0">
                    <span
                      className={cn(
                        'block font-display display-tight text-[19px]',
                        pending ? 'text-warn' : voided ? 'text-idle line-through' : 'text-ice',
                      )}
                    >
                      {ticket.number ?? 'Waiting'}
                    </span>
                    <span className="mt-0.5 block font-label text-[11px] uppercase tracking-[0.08em] text-idle">
                      {stamp(ticket.createdAt)}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[16px] font-semibold text-ink">
                        {customer?.name ?? 'Unknown'}
                      </span>
                      {voided && (
                        <StatusPill tone="idle" size="sm">
                          Void
                        </StatusPill>
                      )}
                      {pending && (
                        <StatusPill tone="warn" size="sm">
                          Waiting to sync
                        </StatusPill>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[14px] text-cc-muted">
                      {materialSummary(ticket)}
                    </span>
                    <span className="mt-0.5 block truncate font-label text-[12px] uppercase tracking-[0.08em] text-idle">
                      {ticket.address}
                      {job && (
                        <>
                          <span className="px-1.5">/</span>
                          Job linked
                        </>
                      )}
                    </span>
                  </span>

                  <span className="shrink-0 font-display display-tight tnum text-[22px]">
                    {usd(totals.total)}
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
