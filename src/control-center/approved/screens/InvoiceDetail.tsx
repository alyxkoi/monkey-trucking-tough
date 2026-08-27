import { useState } from 'react'
import { MessageSquare, Phone } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { RecordPaymentSheet } from '@/control-center/approved/components/money/MoneySheets'
import { ReviewRequestPanel } from '@/control-center/approved/components/automation/FollowUpState'
import { ChangeHistory, VoidReasonSheet } from '@/control-center/approved/components/money/VoidReasonSheet'
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
import { Panel, PanelTitle } from '@/control-center/approved/components/ui/Panel'
import { EmptyState } from '@/control-center/approved/components/ui/States'
import { StatusPill, type PillTone } from '@/control-center/approved/components/ui/StatusPill'
import { cn } from '@/control-center/approved/lib/cn'
import { usd, usdExact } from '@/control-center/approved/lib/format'
import { smsHref, telHref } from '@/control-center/approved/lib/status'
import { useAppState } from '@/control-center/approved/state/AppState'
import { PAYMENT_METHOD_LABEL, invoiceStatus, type InvoiceStatus } from '@/control-center/approved/state/moneyData'
import { ticketTotals } from '@/control-center/approved/state/ticketsData'

const TONE: Record<InvoiceStatus, PillTone> = {
  DRAFT: 'neutral',
  SENT: 'ice',
  OVERDUE: 'now',
  PAID: 'ok',
  VOID: 'idle',
}

const LABEL: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  OVERDUE: 'Overdue',
  PAID: 'Paid',
  VOID: 'Void',
}

/**
 * The amount block carries the state of the invoice as a tinted field, so the
 * screen answers where does this stand before anything is read. Everything that
 * supports it stays neutral, which is what keeps the tint meaningful instead of
 * decorative.
 */
const AMOUNT_SURFACE: Record<InvoiceStatus, string> = {
  DRAFT: 'surface',
  SENT: 'surface-ice',
  OVERDUE: 'surface-warm',
  PAID: 'surface-ok',
  VOID: 'surface',
}

const AMOUNT_ACCENT: Record<InvoiceStatus, string> = {
  DRAFT: 'text-ink',
  SENT: 'text-ink',
  OVERDUE: 'text-mt-red',
  PAID: 'text-ok',
  VOID: 'text-idle line-through',
}

function stamp(at: number | undefined): string {
  if (!at) return 'Not yet'
  return new Date(at).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function InvoiceDetail() {
  const { invoiceId = '' } = useParams()
  const navigate = useNavigate()
  const {
    invoiceById,
    customerById,
    jobById,
    quoteById,
    ticketById,
    paymentsForInvoice,
    sendInvoice,
    resendInvoice,
    voidInvoice,
    voidPayment,
  } = useAppState()
  const [paymentSheet, setPaymentSheet] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidPaymentId, setVoidPaymentId] = useState<string | null>(null)

  const { entry, recommend, markActed } = useAttentionEntry()
  const invoice = invoiceById(invoiceId)
  if (!invoice) {
    return (
      <Panel>
        <EmptyState
          title="Invoice not found"
          line="This invoice record could not be found."
          action={<SecondaryButton onClick={() => navigate('/admin/money')}>Back to money</SecondaryButton>}
        />
      </Panel>
    )
  }

  const status = invoiceStatus(invoice)
  const customer = customerById(invoice.customerId)
  const job = invoice.jobId ? jobById(invoice.jobId) : undefined
  const quote = invoice.quoteId ? quoteById(invoice.quoteId) : undefined
  const payments = paymentsForInvoice(invoice.id)
  const tickets = invoice.ticketIds
    .map((id) => ticketById(id))
    .filter((ticket): ticket is NonNullable<typeof ticket> => Boolean(ticket))

  return (
    <div className="animate-page space-y-5 lg:space-y-6">
      <RecordHeader
        eyebrow={`Invoice ${invoice.number}`}
        title={customer?.name ?? 'Invoice'}
        onBack={() => navigate('/admin/money')}
        right={<StatusPill tone={TONE[status]}>{LABEL[status]}</StatusPill>}
      />

      {entry && <AttentionBanner entry={entry} />}

      {invoice.disputed && (
        <SalvadorNeeded line="The customer says the amount is wrong. The AI did not argue and every reminder is paused until you settle it." />
      )}

      {invoice.claimedPaid && (
        <div className="rounded-panel border border-warn/40 bg-warn/10 p-4">
          <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-warn">
            Says they paid
          </div>
          <p className="mt-1.5 text-[16px] leading-snug text-ink">
            {PAYMENT_METHOD_LABEL[invoice.claimedPaid.method]}, in their words:{' '}
            <span className="text-warn">{invoice.claimedPaid.note}</span>
          </p>
          <p className="mt-2 text-[14px] leading-snug text-cc-muted">
            Nothing has been marked paid. The AI thanked them and stopped there. Check the
            account, then record it yourself.
          </p>
          <AttentionTarget
            active={recommend === 'payment'}
            priority={entry?.priority}
            onInteract={markActed}
            className="mt-4"
          >
            <SecondaryButton size="sm" onClick={() => setPaymentSheet(true)}>
              Verify and record
            </SecondaryButton>
          </AttentionTarget>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="min-w-0 space-y-5 lg:col-span-7 lg:space-y-6 2xl:col-span-8">
          <section className={cn('overflow-hidden rounded-block', AMOUNT_SURFACE[status])}>
            <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-start sm:justify-between lg:p-7">
              <div className="min-w-0">
                <div className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-cc-muted">
                  Amount
                </div>
                <div
                  className={cn(
                    'num-safe mt-1 font-display display-tight tnum text-[56px] sm:text-[68px]',
                    AMOUNT_ACCENT[status],
                  )}
                >
                  {usdExact(invoice.amount)}
                </div>
                <p className="mt-2.5 max-w-[46ch] text-[14px] leading-snug text-cc-muted">
                  {invoice.amountSource === 'TICKET'
                    ? 'Direct material order. This is the finalised ticket total, because there is no job or quote behind it.'
                    : 'The agreed amount from the job. Tickets are attached as delivery proof and never change this figure.'}
                </p>
              </div>

              <div className="shrink-0 text-left sm:text-right">
                <div className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-cc-muted">
                  Due
                </div>
                <div className="mt-1.5 text-[17px] font-semibold text-ink">
                  {stamp(invoice.dueAt)}
                </div>
                {status === 'PAID' && (
                  <div className="mt-1 text-[14px] text-ok">Paid {stamp(invoice.paidAt)}</div>
                )}
              </div>
            </div>

            <div className="space-y-4 border-t border-white/[0.08] px-5 py-5 lg:px-7">
              <Field label="Work" value={invoice.description} />
              {invoice.voidReason && <Field label="Voided because" value={invoice.voidReason} />}
              {invoice.disputeNote && <Field label="What they said" value={invoice.disputeNote} />}

              {customer && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/*
                    A dispute is settled by talking, and a spent chase sequence
                    means it is a person's job now. Both land here.
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
                </div>
              )}
            </div>
          </section>

          <Panel title={<PanelTitle tone="muted">Delivery proof</PanelTitle>} padded={false}>
            {tickets.length === 0 ? (
              <div className="border-t border-line px-5 py-5 text-[15px] leading-snug text-cc-muted">
                No tickets on this one. Not every job moves material.
              </div>
            ) : (
              <div className="divide-y divide-line border-t border-line">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                    className="row-hover flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-white/[0.04]"
                  >
                    <span className="w-[80px] shrink-0 font-display display-tight text-[18px] text-ice">
                      {ticket.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-cc-muted">
                      {ticket.address}
                    </span>
                    <span className="shrink-0 font-display display-tight tnum text-[18px] text-cc-muted">
                      {usd(ticketTotals(ticket).total)}
                    </span>
                  </button>
                ))}
                {invoice.amountSource !== 'TICKET' && (
                  <p className="px-5 py-3 text-[13px] leading-snug text-cc-muted">
                    These totals are proof of what went out. They are not added up into the
                    invoice amount.
                  </p>
                )}
              </div>
            )}
          </Panel>

          {payments.length > 0 && (
            <Panel title={<PanelTitle tone="ok">Payments</PanelTitle>} variant="ok" padded={false}>
              <div className="divide-y divide-white/[0.07] border-t border-white/[0.07]">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center gap-4 px-5 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block font-label text-[13px] uppercase tracking-[0.08em] text-ink">
                        {PAYMENT_METHOD_LABEL[payment.method]}
                      </span>
                      <span className="mt-0.5 block text-[14px] text-cc-muted">
                        {payment.voidedAt
                          ? `Voided by ${payment.voidedBy}, ${payment.voidReason}`
                          : `Received ${stamp(payment.receivedAt)}, confirmed by a person`}
                      </span>
                    </span>
                    {!payment.voidedAt && (
                      <QuietButton size="sm" onClick={() => setVoidPaymentId(payment.id)}>
                        Void
                      </QuietButton>
                    )}
                    <span
                      className={
                        payment.voidedAt
                          ? 'shrink-0 font-display display-tight tnum text-[20px] text-idle line-through'
                          : 'shrink-0 font-display display-tight tnum text-[20px] text-ok'
                      }
                    >
                      {usdExact(payment.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-5 lg:space-y-6 2xl:col-span-4">
          {status === 'DRAFT' && (
            <NextStep
              line="Review it, then send the bill. Sending sets the due date three days out."
              action={
                <PrimaryButton tone="onSolid" onClick={() => sendInvoice(invoice.id)}>
                  Send Invoice
                </PrimaryButton>
              }
            />
          )}
          {(status === 'SENT' || status === 'OVERDUE') && (
            <NextStep
              line="Record the payment once the money has actually landed."
              action={
                <>
                  <AttentionTarget
                    active={recommend === 'payment'}
                    priority={entry?.priority}
                    onInteract={markActed}
                  >
                    <PrimaryButton tone="onSolid" onClick={() => setPaymentSheet(true)}>
                      Record Payment
                    </PrimaryButton>
                  </AttentionTarget>
                  <SecondaryButton tone="onSolid" onClick={() => resendInvoice(invoice.id)}>
                    Resend Invoice
                  </SecondaryButton>
                </>
              }
            />
          )}

          <Panel title="More" variant="glass">
            <ContextualActionBar align="start" className="sm:flex-col sm:items-stretch">
              {status === 'PAID' && (
                <p className="text-[15px] leading-snug text-cc-muted">
                  Settled. A review request goes out about a day after payment, as long as
                  there is no complaint open.
                </p>
              )}
              {status === 'VOID' && (
                <p className="text-[15px] leading-snug text-cc-muted">
                  Voided and kept. Financial records are never deleted.
                </p>
              )}
            </ContextualActionBar>

            {status !== 'VOID' && status !== 'PAID' && (
              <div className="mt-4 border-t border-line pt-4">
                <QuietButton size="sm" onClick={() => setVoidOpen(true)}>
                  Void Invoice
                </QuietButton>
              </div>
            )}
          </Panel>

          <Panel title="Follow up" padded={false}>
            {invoice.disputed ? (
              <div className="border-t border-line px-5 py-5 text-[15px] leading-snug text-warn">
                Paused. Chasing money while an amount is being argued about is how you lose
                a customer.
              </div>
            ) : invoice.followUps.length === 0 ? (
              <div className="border-t border-line px-5 py-5 text-[15px] leading-snug text-cc-muted">
                {status === 'DRAFT'
                  ? 'Nothing goes out until you send it.'
                  : 'Nothing sent yet. A reminder goes out on the due date.'}
              </div>
            ) : (
              <div className="divide-y divide-line border-t border-line">
                {invoice.followUps.map((entry) => (
                  <div key={entry.at} className="px-5 py-3">
                    <div className="text-[15px] text-ink">{entry.label}</div>
                    <div className="font-label text-[12px] uppercase tracking-[0.08em] text-idle">
                      {stamp(entry.at)}
                    </div>
                  </div>
                ))}
                {status === 'OVERDUE' && invoice.followUps.length >= 3 && (
                  <p className="px-5 py-3 text-[13px] leading-snug text-cc-muted">
                    The automated reminders are finished. It is a human job from here.
                  </p>
                )}
              </div>
            )}
          </Panel>

          {(job || quote) && (
            <Panel title="Where it came from" padded={false}>
              <div className="divide-y divide-line border-t border-line">
                {job && (
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/jobs/${job.id}`)}
                    className="row-hover flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-white/[0.04]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-label text-[12px] uppercase tracking-[0.12em] text-idle">
                        Job
                      </span>
                      <span className="block truncate text-[15px] font-semibold text-ink">
                        {job.description}
                      </span>
                    </span>
                    <span className="shrink-0 font-display display-tight tnum text-[18px]">
                      {usd(job.agreedAmount)}
                    </span>
                  </button>
                )}
                {quote && (
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/quotes/${quote.id}`)}
                    className="row-hover flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-white/[0.04]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-label text-[12px] uppercase tracking-[0.12em] text-idle">
                        Quote {quote.number}
                      </span>
                      <span className="block truncate text-[15px] font-semibold text-ink">
                        {quote.description}
                      </span>
                    </span>
                  </button>
                )}
              </div>
            </Panel>
          )}

          <ReviewRequestPanel invoice={invoice} job={job} />

          <ChangeHistory history={invoice.history} />

          {customer && (
            <Panel title="Customer">
              <QuietButton size="sm" onClick={() => navigate(`/admin/customers/${customer.id}`)}>
                Open {customer.name}
              </QuietButton>
            </Panel>
          )}
        </div>
      </div>

      <RecordPaymentSheet
        open={paymentSheet}
        onClose={() => setPaymentSheet(false)}
        invoiceId={invoice.id}
      />

      <VoidReasonSheet
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        onConfirm={(reason) => voidInvoice(invoice.id, reason)}
        title="Void invoice"
        line="The invoice stays exactly as it was written, with your reason and who voided it. Financial records are never deleted."
        placeholder="Billed the wrong job"
        confirmLabel="Void this invoice"
      />

      <VoidReasonSheet
        open={voidPaymentId !== null}
        onClose={() => setVoidPaymentId(null)}
        onConfirm={(reason) => voidPaymentId && voidPayment(voidPaymentId, reason)}
        title="Void payment"
        line="The payment is kept and marked void, and the invoice goes back to open so the money still shows as owed."
        placeholder="Recorded against the wrong invoice"
        confirmLabel="Void this payment"
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
