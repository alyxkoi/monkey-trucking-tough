import { useState } from 'react'
import { MessageSquare, Phone, Plus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { ActionLink, SecondaryButton } from '@/control-center/approved/components/ui/Button'
import { RecordHeader } from '@/control-center/approved/components/ui/RecordHeader'
import { TextArea } from '@/control-center/approved/components/ui/Field'
import { NumberModule } from '@/control-center/approved/components/ui/NumberModule'
import { Panel, PanelTitle } from '@/control-center/approved/components/ui/Panel'
import { SolidInfoModule } from '@/control-center/approved/components/ui/SolidInfoModule'
import { EmptyState } from '@/control-center/approved/components/ui/States'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { TimelineEntry } from '@/control-center/approved/components/ui/TimelineEntry'
import { cn } from '@/control-center/approved/lib/cn'
import { usd } from '@/control-center/approved/lib/format'
import { LEAD_LABEL, LEAD_TONE, smsHref, telHref } from '@/control-center/approved/lib/status'
import { useAppState } from '@/control-center/approved/state/AppState'
import type { Activity, Message } from '@/control-center/approved/state/salesData'
import { parseDateKey } from '@/control-center/approved/state/jobsData'
import { ReactivationPanel } from '@/control-center/approved/components/automation/FollowUpState'

type TimelineFilter = 'ALL' | 'CONVERSATIONS' | 'QUOTES' | 'JOBS' | 'TICKETS' | 'MONEY'

const FILTERS: { value: TimelineFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'CONVERSATIONS', label: 'Conversations' },
  { value: 'QUOTES', label: 'Quotes' },
  { value: 'JOBS', label: 'Jobs' },
  { value: 'TICKETS', label: 'Tickets' },
  { value: 'MONEY', label: 'Money' },
]

type TimelineItem =
  | { id: string; at: number; type: 'message'; message: Message }
  | { id: string; at: number; type: 'activity'; activity: Activity }

function dateLabel(at: number): string {
  return new Date(at)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase()
}

export function CustomerDetail() {
  const { customerId = '' } = useParams()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<TimelineFilter>('ALL')
  const {
    customerById,
    leadsForCustomer,
    quotesForCustomer,
    activitiesForCustomer,
    jobsForCustomer,
    photoJobsForCustomer,
    invoices,
    tickets,
    updateCustomerNotes,
    setNewLeadSheetOpen,
  } = useAppState()

  const customer = customerById(customerId)
  const [notesDraft, setNotesDraft] = useState({ customerId: '', value: '' })
  const notes = notesDraft.customerId === customer?.id ? notesDraft.value : customer?.notes ?? ''
  if (!customer) {
    return (
      <Panel>
        <EmptyState
          title="Customer not found"
          line="This customer record could not be found."
          action={
            <SecondaryButton onClick={() => navigate('/admin/customers')}>
              Back to customers
            </SecondaryButton>
          }
        />
      </Panel>
    )
  }

  const leads = leadsForCustomer(customer.id)
  const quotes = quotesForCustomer(customer.id)
  const activities = activitiesForCustomer(customer.id)
  const jobs = jobsForCustomer(customer.id)
  const photoJobs = photoJobsForCustomer(customer.id)

  // The timeline builds itself from what actually happened, it is not typed in.
  const items: TimelineItem[] = [
    ...leads.flatMap((lead) =>
      lead.messages
        .filter((message) => message.actor !== 'system')
        .map<TimelineItem>((message) => ({
          id: message.id,
          at: message.at,
          type: 'message',
          message,
        })),
    ),
    ...activities.map<TimelineItem>((activity) => ({
      id: activity.id,
      at: activity.at,
      type: 'activity',
      activity,
    })),
  ].sort((a, b) => b.at - a.at)

  /**
   * A timeline event that points at a real record opens it. The reference is the
   * record's own identifier, so a ticket carries its MT number and an invoice
   * carries its invoice number, and both are resolved back to an id here rather
   * than being stored twice.
   */
  const openRecord = (activity: Activity) => {
    if (!activity.ref) return undefined
    if (activity.kind === 'job') return () => navigate(`/admin/jobs/${activity.ref}`)
    if (activity.kind === 'quote') return () => navigate(`/admin/quotes/${activity.ref}`)
    if (activity.kind === 'ticket') {
      const ticket = tickets.find((entry) => entry.number === activity.ref)
      return ticket ? () => navigate(`/admin/tickets/${ticket.id}`) : undefined
    }
    if (activity.kind === 'money') {
      const invoice = invoices.find((entry) => entry.number === activity.ref)
      return invoice ? () => navigate(`/admin/money/invoices/${invoice.id}`) : undefined
    }
    return undefined
  }

  const visible = items.filter((item) => {
    if (filter === 'ALL') return true
    if (filter === 'CONVERSATIONS') return item.type === 'message'
    if (item.type !== 'activity') return false
    if (filter === 'QUOTES') return item.activity.kind === 'quote'
    if (filter === 'JOBS') return item.activity.kind === 'job'
    if (filter === 'TICKETS') return item.activity.kind === 'ticket'
    return item.activity.kind === 'money'
  })

  return (
    <div className="animate-page space-y-5 lg:space-y-6">
      <RecordHeader
        eyebrow="Customer"
        title={customer.name}
        onBack={() => navigate('/admin/customers')}
        right={
          leads.length > 1 ? (
            <StatusPill tone="ok" size="sm">
              Repeat
            </StatusPill>
          ) : undefined
        }
      />

      {/*
        Identity is the one solid colour field on this screen. Everything below it
        supports it, so the eye lands on who this is and how to reach them before
        it reads a single row of history.
      */}
      <SolidInfoModule tone="ice">
        <div className="flex flex-col gap-7 p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:p-8">
          <div className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-label text-[13px] font-semibold uppercase tracking-[0.1em] text-canvas/70">
              <span className="text-canvas">{customer.phone}</span>
              {customer.email && (
                <span className="normal-case tracking-normal">{customer.email}</span>
              )}
              <span>{customer.source}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionLink
                size="sm"
                tone="onSolid"
                href={telHref(customer.phone)}
                icon={<Phone className="h-4 w-4" strokeWidth={2.2} />}
              >
                Call
              </ActionLink>
              <ActionLink
                size="sm"
                tone="onSolid"
                href={smsHref(customer.phone)}
                icon={<MessageSquare className="h-4 w-4" strokeWidth={2.2} />}
              >
                Text
              </ActionLink>
              <SecondaryButton
                size="sm"
                tone="onSolid"
                onClick={() => setNewLeadSheetOpen(true)}
                icon={<Plus className="h-4 w-4" strokeWidth={2.6} />}
              >
                New Lead
              </SecondaryButton>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-3 gap-px overflow-hidden rounded-panel bg-canvas/15">
            {[
              { label: 'Leads', value: leads.length },
              { label: 'Quotes', value: quotes.length },
              { label: 'Jobs', value: jobs.length },
            ].map((entry) => (
              <div key={entry.label} className="bg-ice px-5 py-4">
                <NumberModule
                  label={entry.label}
                  value={String(entry.value)}
                  size="sm"
                  accent="onSolid"
                  onSolid
                />
              </div>
            ))}
          </div>
        </div>
      </SolidInfoModule>

      {/*
        The history is the long read, so it holds the wide column on desktop and
        everything that supports it sits beside it instead of underneath.
      */}
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="min-w-0 space-y-5 lg:col-span-7 lg:space-y-6 2xl:col-span-8">
          {/* Frosted, so the long read separates from the flat tints around it. */}
          <Panel title="History" variant="glass" padded={false}>
            <div className="no-scrollbar w-full overflow-x-auto border-y border-white/[0.07] px-5 py-3.5">
              <div className="flex items-center gap-2">
                {FILTERS.map((entry) => {
                  const selected = entry.value === filter
                  return (
                    <button
                      key={entry.value}
                      type="button"
                      onClick={() => setFilter(entry.value)}
                      className={cn(
                        'row-hover h-11 shrink-0 rounded-xl border px-3.5 font-label text-[13px] font-semibold uppercase tracking-[0.1em]',
                        selected
                          ? 'field-ice border-transparent text-canvas'
                          : 'border-white/10 bg-white/[0.05] text-cc-muted hover:bg-white/[0.09] hover:text-ink',
                      )}
                    >
                      {entry.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {visible.length === 0 ? (
              <EmptyState
                title="Nothing here yet"
                line="This part of the history fills in as work happens for this customer."
              />
            ) : (
              <div key={filter} className="animate-swap p-5 lg:p-6">
                {visible.map((item, index) => {
                  const last = index === visible.length - 1
                  if (item.type === 'message') {
                    return (
                      <TimelineEntry
                        key={item.id}
                        actor={item.message.actor === 'system' ? 'system' : item.message.actor}
                        time={dateLabel(item.at)}
                        last={last}
                      >
                        {item.message.text}
                      </TimelineEntry>
                    )
                  }
                  const activity = item.activity
                  return (
                    <TimelineEntry
                      key={item.id}
                      actor="system"
                      kind={activity.kind}
                      time={dateLabel(item.at)}
                      title={activity.title}
                      onOpen={openRecord(activity)}
                      last={last}
                      attachment={
                        activity.amount !== undefined ? (
                          <span className="num-safe inline-flex font-display display-tight tnum text-[20px] text-ok">
                            {usd(activity.amount)}
                          </span>
                        ) : undefined
                      }
                    >
                      {activity.body}
                    </TimelineEntry>
                  )
                })}
              </div>
            )}
          </Panel>

          <Panel title={<PanelTitle tone="muted">Photos</PanelTitle>} padded={false}>
            {photoJobs.length === 0 ? (
              <div className="border-t border-white/[0.07]">
                <EmptyState
                  title="No photos yet"
                  line="Photos belong to the job they were taken on, and gather here automatically."
                />
              </div>
            ) : (
              <div className="divide-y divide-white/[0.07] border-t border-white/[0.07]">
                {photoJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => navigate(`/admin/jobs/${job.id}`)}
                    className="row-hover block w-full px-5 py-4 text-left hover:bg-white/[0.04] lg:px-6"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[15px] font-semibold text-ink">
                        {job.description}
                      </span>
                      <span className="font-label text-[12px] uppercase tracking-[0.1em] text-idle">
                        {dateLabel(parseDateKey(job.date).getTime())}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {job.photos.map((photo) => (
                        <img
                          key={photo}
                          src={photo}
                          alt={job.description}
                          loading="lazy"
                          className="aspect-[4/3] w-full rounded-xl border border-white/10 object-cover"
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-5 lg:space-y-6 2xl:col-span-4">
          {leads.length > 0 && (
            <Panel title="Opportunities" variant="ice" padded={false}>
              <div className="divide-y divide-white/[0.07] border-t border-white/[0.07]">
                {leads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => navigate(`/admin/leads/${lead.id}`)}
                    className="row-hover flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-white/[0.05]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">
                        {lead.need}
                      </span>
                      <span className="mt-0.5 block font-label text-[12px] uppercase tracking-[0.1em] text-idle">
                        {dateLabel(lead.createdAt)}
                        <span className="px-1.5">/</span>
                        {lead.source}
                      </span>
                    </span>
                    <StatusPill tone={LEAD_TONE[lead.status]} size="sm" className="shrink-0">
                      {LEAD_LABEL[lead.status]}
                    </StatusPill>
                  </button>
                ))}
              </div>
            </Panel>
          )}

          <ReactivationPanel
            jobs={jobs}
            invoices={invoices.filter((invoice) => invoice.customerId === customer.id)}
            leads={leads}
            quotes={quotes}
          />

          <Panel title={<PanelTitle tone="muted">Notes</PanelTitle>}>
            <TextArea
              value={notes}
              onChange={(value) => {
                setNotesDraft({ customerId: customer.id, value })
                updateCustomerNotes(customer.id, value)
              }}
              rows={3}
              placeholder="Gate codes, who to ask for, how they like to pay"
            />
            <p className="mt-2 text-[13px] text-cc-muted">
              Saves as you type. Job sites are not kept here, they belong to the job and the
              ticket.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
