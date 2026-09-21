import { Check, X } from 'lucide-react'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { cn } from '@/control-center/approved/lib/cn'
import type { Job } from '@/control-center/approved/state/jobsData'
import type { Invoice } from '@/control-center/approved/state/moneyData'
import { invoiceStatus } from '@/control-center/approved/state/moneyData'

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
 * One request per job, immediately after full confirmed payment, and only when
 * nothing is unhappy. The tone leads with the outcome, the link is the last part.
 */
export function ReviewRequestPanel({ invoice, job, configured, sent }: { invoice: Invoice; job?: Job; configured: boolean; sent: boolean }) {
  if (invoiceStatus(invoice) !== 'PAID') return null

  const completed = job?.status === 'COMPLETED'
  const noComplaint = !invoice.disputed
  const eligible = completed && noComplaint && configured
  return (
    <Panel
      title="Review request"
      right={
        <StatusPill tone={!configured ? 'warn' : !eligible ? 'warn' : sent ? 'ok' : 'ice'} size="sm">
          {!configured ? 'Setup required' : !eligible ? 'Paused' : sent ? 'Sent' : 'Scheduled'}
        </StatusPill>
      }
    >
      <p className="text-[15px] leading-snug text-ink/85">
        {!configured
          ? 'Add the Google review link in Communication & AI settings before this can send.'
          : !eligible
          ? 'Held back. Asking for a review while something is unresolved is the wrong move, and Salvador decides whether it goes later or not at all.'
          : sent
            ? 'One request went out. There is never a second one for the same job.'
            : 'Ready to send immediately after the completed job is fully paid, including evenings and weekends. Consent, human takeover and provider safeguards still apply.'}
      </p>

      <ul className="mt-4 space-y-2">
        <Condition met={true} label="Invoice paid" />
        <Condition met={completed} label="Job completed" />
        <Condition met={noComplaint} label="No complaint or dispute open" />
        <Condition met={configured} label="Google review link configured" />
        <Condition met={!sent} label="No review request sent for this job yet" />
      </ul>
    </Panel>
  )
}
