import { useState } from 'react'
import { Bell, BellOff, MessageSquare, Phone } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { ScheduleJobSheet } from '@/control-center/approved/components/jobs/ScheduleJobSheet'
import { ActionLink, PrimaryButton, QuietButton, SecondaryButton } from '@/control-center/approved/components/ui/Button'
import { SalvadorNeeded } from '@/control-center/approved/components/ui/Conversation'
import { ContextualActionBar } from '@/control-center/approved/components/ui/ContextualActionBar'
import {
  AttentionBanner,
  AttentionTarget,
  NextStep,
  useAttentionEntry,
} from '@/control-center/approved/components/ui/Guidance'
import { RecordHeader } from '@/control-center/approved/components/ui/RecordHeader'
import { TextArea } from '@/control-center/approved/components/ui/Field'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { EmptyState } from '@/control-center/approved/components/ui/States'
import { StatusPill, type PillTone } from '@/control-center/approved/components/ui/StatusPill'
import { usd } from '@/control-center/approved/lib/format'
import { QUOTE_LABEL, QUOTE_TONE, smsHref, telHref } from '@/control-center/approved/lib/status'
import { useAppState } from '@/control-center/approved/state/AppState'
import {
  JOB_CATEGORY_LABEL,
  JOB_STATUS_LABEL,
  formatTime,
  parseDateKey,
  reminderFor,
  type JobStatus,
} from '@/control-center/approved/state/jobsData'
import { quoteTotals } from '@/control-center/approved/state/salesData'
import { materialSummary, ticketTotals } from '@/control-center/approved/state/ticketsData'

const STATUS_TONE: Record<JobStatus, PillTone> = {
  SCHEDULED: 'ice',
  IN_PROGRESS: 'warn',
  COMPLETED: 'ok',
  CANCELLED: 'idle',
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function reminderLabel(at: number): string {
  const date = new Date(at)
  const time = date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toUpperCase()
  return `${WEEKDAY[date.getDay()]} ${MONTH[date.getMonth()]} ${date.getDate()}, ${time}`
}

export function JobDetail() {
  const { jobId = '' } = useParams()
  const navigate = useNavigate()
  const {
    jobById,
    customerById,
    quoteById,
    completeJob,
    cancelJob,
    startJob,
    updateJobNotes,
    ticketsForJob,
    createInvoiceFromJob,
    invoiceForJob,
  } = useAppState()
  const [rescheduling, setRescheduling] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const { entry, recommend, markActed } = useAttentionEntry()
  const job = jobById(jobId)
  const [notesDraft, setNotesDraft] = useState({ jobId: '', value: '' })
  const notes = notesDraft.jobId === job?.id ? notesDraft.value : job?.notes ?? ''
  if (!job) {
    return (
      <Panel>
        <EmptyState
          title="Job not found"
          line="This job record could not be found."
          action={<SecondaryButton onClick={() => navigate('/admin/jobs')}>Back to jobs</SecondaryButton>}
        />
      </Panel>
    )
  }

  const customer = customerById(job.customerId)
  const quote = job.quoteId ? quoteById(job.quoteId) : undefined
  const date = parseDateKey(job.date)
  const reminder = reminderFor(job)
  const jobTickets = ticketsForJob(job.id)
  const existingInvoice = invoiceForJob(job.id)
  const open = job.status === 'SCHEDULED' || job.status === 'IN_PROGRESS'

  return (
    <div className="space-y-5">
      <RecordHeader
        eyebrow="Job"
        title={customer?.name ?? 'Job'}
        onBack={() => navigate('/admin/jobs')}
        right={
          <StatusPill tone={STATUS_TONE[job.status]}>{JOB_STATUS_LABEL[job.status]}</StatusPill>
        }
      />

      {/* Why this screen is open, when Needs Attention is what opened it. */}
      {entry && <AttentionBanner entry={entry} />}

      {job.changeRequested && (
        <SalvadorNeeded line="The customer asked to move this one. The AI acknowledged it and stopped, moving a job is your call." />
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-7">
          <Panel>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
                  {WEEKDAY[date.getDay()]}
                </div>
                <div className="mt-1.5 flex items-end gap-3">
                  <span className="font-display display-tight text-[56px] text-ice">
                    {date.getDate()}
                  </span>
                  <div className="pb-2">
                    <div className="font-label text-[15px] font-semibold uppercase tracking-[0.14em] text-ink">
                      {MONTH[date.getMonth()]}
                    </div>
                    <div className="font-display display-tight text-[20px] text-ink">
                      {formatTime(job)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-left sm:text-right">
                <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
                  Agreed amount
                </div>
                <div className="mt-1.5 font-display display-tight tnum text-[38px]">
                  {usd(job.agreedAmount)}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4 border-t border-line pt-5">
              <Field label="Job type" value={JOB_CATEGORY_LABEL[job.category]} />
              <Field label="Address" value={job.address} />
              <Field label="Work" value={job.description} />
              {job.cancelReason && <Field label="Cancelled because" value={job.cancelReason} />}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {customer && (
                <>
                  {/*
                    The same Call and Text that were always here. Arriving from a
                    blocked job simply rings them so the eye lands on the phone.
                  */}
                  <AttentionTarget
                    active={recommend === 'contact'}
                    priority={entry?.priority}
                    onInteract={markActed}
                  >
                    <ActionLink
                      size="sm"
                      href={telHref(customer.phone)}
                      icon={<Phone className="h-4 w-4" strokeWidth={2.2} />}
                    >
                      Call
                    </ActionLink>
                  </AttentionTarget>
                  <AttentionTarget
                    active={recommend === 'contact'}
                    priority={entry?.priority}
                    onInteract={markActed}
                  >
                    <ActionLink
                      size="sm"
                      href={smsHref(customer.phone)}
                      icon={<MessageSquare className="h-4 w-4" strokeWidth={2.2} />}
                    >
                      Text
                    </ActionLink>
                  </AttentionTarget>
                  <SecondaryButton
                    size="sm"
                    onClick={() => navigate(`/admin/customers/${customer.id}`)}
                  >
                    Customer
                  </SecondaryButton>
                </>
              )}
            </div>
          </Panel>

          <Panel title="Notes">
            <TextArea
              value={notes}
              onChange={(value) => {
                setNotesDraft({ jobId: job.id, value })
                updateJobNotes(job.id, value)
              }}
              rows={3}
              placeholder="Gate codes, where to drop, who to ask for"
            />
            <p className="mt-2 text-[13px] text-cc-muted">Saves as you type.</p>
          </Panel>

          {job.photos.length > 0 && (
            <Panel title="Photos">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {job.photos.map((photo) => (
                  <img
                    key={photo}
                    src={photo}
                    alt={job.description}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-xl border border-line object-cover"
                  />
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-5">
          {/*
            The normal progression, in icy blue. When an attention banner is on
            screen above it, red or amber has already claimed the eye and this
            waits its turn. Once the exception clears, this is the loudest thing
            on the page again.
          */}
          {job.status === 'SCHEDULED' && (
            <NextStep
              line="Create the delivery ticket when the material goes out."
              action={
                <>
                  <PrimaryButton
                    tone="onSolid"
                    onClick={() => navigate(`/admin/tickets/new?job=${job.id}`)}
                  >
                    Create Ticket
                  </PrimaryButton>
                  <SecondaryButton tone="onSolid" onClick={() => completeJob(job.id)}>
                    Complete Job
                  </SecondaryButton>
                </>
              }
            />
          )}
          {job.status === 'IN_PROGRESS' && (
            <NextStep
              line="Mark it complete once the work is finished."
              action={
                <>
                  <PrimaryButton tone="onSolid" onClick={() => completeJob(job.id)}>
                    Complete Job
                  </PrimaryButton>
                  <SecondaryButton
                    tone="onSolid"
                    onClick={() => navigate(`/admin/tickets/new?job=${job.id}`)}
                  >
                    Create Ticket
                  </SecondaryButton>
                </>
              }
            />
          )}
          {job.status === 'COMPLETED' && (
            <NextStep
              line={
                existingInvoice
                  ? 'The bill for this work has already gone out.'
                  : 'Send the bill for this completed work.'
              }
              action={
                <PrimaryButton
                  tone="onSolid"
                  onClick={async () => {
                    const id = existingInvoice?.id ?? await createInvoiceFromJob(job.id)
                    if (id) navigate(`/admin/money/invoices/${id}`)
                  }}
                >
                  {existingInvoice ? 'View Invoice' : 'Create Invoice'}
                </PrimaryButton>
              }
            />
          )}

          <Panel title="More">
            <ContextualActionBar align="start" className="sm:flex-col sm:items-stretch">
              {job.status === 'SCHEDULED' && (
                <>
                  <SecondaryButton onClick={() => setRescheduling(true)}>
                    Reschedule
                  </SecondaryButton>
                  <QuietButton onClick={() => startJob(job.id)}>Mark in progress</QuietButton>
                </>
              )}
              {job.status === 'CANCELLED' && (
                <div className="space-y-2 text-[15px] leading-snug text-cc-muted">
                  <p>
                    This job is cancelled. The reminder was stopped and it is off the
                    active calendar.
                  </p>
                  <p>
                    The record is kept, not deleted. It stays in the customer history and
                    comes back into the calendar with Show cancelled.
                  </p>
                </div>
              )}
            </ContextualActionBar>

            {open && (
              <div className="mt-4 border-t border-line pt-4">
                {confirmingCancel ? (
                  <div className="space-y-3">
                    <p className="text-[14px] leading-snug text-cc-muted">
                      Cancelling keeps the record and the reason. Nothing is deleted.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <SecondaryButton
                        size="sm"
                        onClick={() => {
                          cancelJob(job.id, 'Cancelled by Salvador')
                          setConfirmingCancel(false)
                        }}
                      >
                        Cancel the job
                      </SecondaryButton>
                      <QuietButton size="sm" onClick={() => setConfirmingCancel(false)}>
                        Keep it
                      </QuietButton>
                    </div>
                  </div>
                ) : (
                  <QuietButton size="sm" onClick={() => setConfirmingCancel(true)}>
                    Cancel Job
                  </QuietButton>
                )}
              </div>
            )}
          </Panel>

          {open && (
            <Panel title="Reminder">
              <div className="flex gap-3.5">
                {reminder.skipped ? (
                  <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-cc-muted" strokeWidth={2} />
                ) : (
                  <Bell className="mt-0.5 h-5 w-5 shrink-0 text-ice" strokeWidth={2} />
                )}
                <div className="min-w-0">
                  <div className="text-[16px] font-semibold text-ink">
                    {reminder.skipped ? 'No reminder on this one' : 'One reminder, 24 hours ahead'}
                  </div>
                  <p className="mt-1 text-[14px] leading-snug text-cc-muted">
                    {reminder.skipped
                      ? 'It was booked inside 24 hours of the work, so a reminder would land after the truck does.'
                      : `Goes out ${reminderLabel(reminder.at)}. Moving the job cancels it and sets a new one.`}
                  </p>
                </div>
              </div>
            </Panel>
          )}

          <Panel title="Quote" padded={false}>
            {quote ? (
              <button
                type="button"
                onClick={() => navigate(`/admin/quotes/${quote.id}`)}
                className="row-hover flex w-full items-center gap-4 border-t border-line px-5 py-4 text-left hover:bg-white/[0.04]"
              >
                <span className="w-[72px] shrink-0 font-display display-tight text-[20px] text-ice">
                  {quote.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">
                    {quote.description}
                  </span>
                  <StatusPill tone={QUOTE_TONE[quote.status]} size="sm" className="mt-1.5">
                    {QUOTE_LABEL[quote.status]}
                  </StatusPill>
                </span>
                <span className="shrink-0 font-display display-tight tnum text-[20px]">
                  {usd(quoteTotals(quote).total)}
                </span>
              </button>
            ) : (
              <div className="border-t border-line px-5 py-5 text-[15px] leading-snug text-cc-muted">
                No quote on this one. A straightforward order does not need a quote forced
                into it.
              </div>
            )}
          </Panel>

          <Panel
            title="Tickets"
            padded={false}
            right={
              <SecondaryButton
                size="sm"
                onClick={() => navigate(`/admin/tickets/new?job=${job.id}`)}
              >
                New Ticket
              </SecondaryButton>
            }
          >
            <div className="border-t border-line">
              {jobTickets.length > 0 ? (
                <div className="divide-y divide-line">
                  {jobTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                      className="row-hover flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-white/[0.04]"
                    >
                      <span className="w-[76px] shrink-0 font-display display-tight text-[18px] text-ice">
                        {ticket.number ?? 'Waiting'}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] text-cc-muted">
                        {materialSummary(ticket)}
                      </span>
                      <span className="shrink-0 font-display display-tight tnum text-[18px]">
                        {usd(ticketTotals(ticket).total)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No tickets yet"
                  line="A ticket is the proof of material and delivery. One ticket can hold several materials and several loads."
                  action={
                    <SecondaryButton
                      size="sm"
                      onClick={() => navigate(`/admin/tickets/new?job=${job.id}`)}
                    >
                      Create Ticket
                    </SecondaryButton>
                  }
                />
              )}
            </div>
          </Panel>

          <Panel title="Invoice" padded={false}>
            <div className="border-t border-line">
              {existingInvoice ? (
                <button
                  type="button"
                  onClick={() => navigate(`/admin/money/invoices/${existingInvoice.id}`)}
                  className="row-hover flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.04]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-label text-[12px] uppercase tracking-[0.12em] text-idle">
                      Invoice {existingInvoice.number}
                    </span>
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {existingInvoice.description}
                    </span>
                  </span>
                  <span className="shrink-0 font-display display-tight tnum text-[20px]">
                    {usd(existingInvoice.amount)}
                  </span>
                </button>
              ) : (
                <EmptyState
                  title="Not invoiced yet"
                  line="Completed work becomes an invoice draft for you to review before it goes out. The agreed amount is what gets billed."
                />
              )}
            </div>
          </Panel>
        </div>
      </div>

      <ScheduleJobSheet
        open={rescheduling}
        onClose={() => setRescheduling(false)}
        job={job}
      />
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
        {label}
      </div>
      <div className="mt-1 text-[16px] leading-snug text-ink">{value}</div>
    </div>
  )
}
