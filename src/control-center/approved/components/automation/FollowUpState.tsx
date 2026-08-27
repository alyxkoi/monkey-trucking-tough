import { Check, X } from 'lucide-react'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { cn } from '@/control-center/approved/lib/cn'
import type { Job } from '@/control-center/approved/state/jobsData'
import type { Invoice } from '@/control-center/approved/state/moneyData'
import { invoiceStatus } from '@/control-center/approved/state/moneyData'
import type { Lead, Quote } from '@/control-center/approved/state/salesData'

const DAY = 24 * 60 * 60 * 1000

function when(at: number): string {
  const delta = at - Date.now()
  if (delta <= 0) return 'already due'
  const hours = Math.round(delta / (60 * 60 * 1000))
  if (hours < 48) return `in about ${hours} ${hours === 1 ? 'hour' : 'hours'}`
  return `in about ${Math.round(delta / DAY)} days`
}

function Condition({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-start gap-3">
      {met ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" strokeWidth={2.6} />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-warn" strokeWidth={2.6} />
      )}
      <span className={cn('text-[15px] leading-snug', met ? 'text-ink/85' : 'text-warn')}>
        {label}
      </span>
    </li>
  )
}

/**
 * Review request.
 *
 * One request per job, about 24 hours after the invoice is paid, and only when
 * nothing is unhappy. The tone leads with the outcome, the link is the last part.
 */
export function ReviewRequestPanel({ invoice, job }: { invoice: Invoice; job?: Job }) {
  if (invoiceStatus(invoice) !== 'PAID') return null

  const completed = job?.status === 'COMPLETED'
  const noComplaint = !invoice.disputed
  const eligible = completed && noComplaint
  const dueAt = (invoice.paidAt ?? Date.now()) + DAY
  const sent = eligible && dueAt <= Date.now()

  return (
    <Panel
      title="Review request"
      right={
        <StatusPill tone={!eligible ? 'warn' : sent ? 'ok' : 'ice'} size="sm">
          {!eligible ? 'Paused' : sent ? 'Sent' : 'Scheduled'}
        </StatusPill>
      }
    >
      <p className="text-[15px] leading-snug text-ink/85">
        {!eligible
          ? 'Held back. Asking for a review while something is unresolved is the wrong move, and Salvador decides whether it goes later or not at all.'
          : sent
            ? 'One request went out. There is never a second one for the same job.'
            : `Goes out ${when(dueAt)}, about a day after the payment landed.`}
      </p>

      <ul className="mt-4 space-y-2">
        <Condition met={true} label="Invoice paid" />
        <Condition met={completed} label="Job completed" />
        <Condition met={noComplaint} label="No complaint or dispute open" />
        <Condition met={true} label="No review request sent for this job yet" />
      </ul>
    </Panel>
  )
}

/**
 * 60 day reactivation.
 *
 * One message, once, about 60 days after completed and paid work. Never a
 * recurring every 60 days sequence.
 */
export function ReactivationPanel({
  jobs,
  invoices,
  leads,
  quotes,
}: {
  jobs: Job[]
  invoices: Invoice[]
  leads: Lead[]
  quotes: Quote[]
}) {
  const paid = invoices
    .filter((invoice) => invoiceStatus(invoice) === 'PAID')
    .sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0))
  const lastPaid = paid[0]
  if (!lastPaid) return null

  const activeLead = leads.some((lead) => ['NEW', 'TALKING', 'QUOTED'].includes(lead.status))
  const activeQuote = quotes.some((quote) => quote.status === 'SENT' || quote.status === 'DRAFT')
  const activeJob = jobs.some(
    (job) => job.status === 'SCHEDULED' || job.status === 'IN_PROGRESS',
  )
  const moneyIssue = invoices.some(
    (invoice) => invoice.disputed || invoiceStatus(invoice) === 'OVERDUE',
  )

  const eligible = !activeLead && !activeQuote && !activeJob && !moneyIssue
  const dueAt = (lastPaid.paidAt ?? Date.now()) + 60 * DAY
  const sent = eligible && dueAt <= Date.now()

  return (
    <Panel
      title="60 day check in"
      right={
        <StatusPill tone={!eligible ? 'idle' : sent ? 'ok' : 'ice'} size="sm">
          {!eligible ? 'Not eligible' : sent ? 'Sent' : 'Scheduled'}
        </StatusPill>
      }
    >
      <p className="text-[15px] leading-snug text-ink/85">
        {!eligible
          ? 'Not going out. They are already in the middle of something with us, so a check in would be noise.'
          : sent
            ? 'The one check in has gone out. It never repeats.'
            : `Goes out ${when(dueAt)}. One warm message, no pressure, and it never repeats.`}
      </p>

      <ul className="mt-4 space-y-2">
        <Condition met={!activeLead} label="No active lead" />
        <Condition met={!activeQuote} label="No open quote" />
        <Condition met={!activeJob} label="No scheduled work" />
        <Condition met={!moneyIssue} label="No money problem or dispute" />
        <Condition met={true} label="Has not opted out" />
      </ul>
    </Panel>
  )
}
