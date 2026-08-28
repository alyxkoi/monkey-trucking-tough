import { useState } from 'react'
import { MessageSquare, Phone } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
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
import { TextArea, TextField } from '@/control-center/approved/components/ui/Field'
import { StatusPill, type PillTone } from '@/control-center/approved/components/ui/StatusPill'
import { cn } from '@/control-center/approved/lib/cn'
import { formatTaxRate, usd, usdExact } from '@/control-center/approved/lib/format'
import { smsHref, telHref } from '@/control-center/approved/lib/status'
import { useAppState } from '@/control-center/approved/state/AppState'
import { PAYMENT_METHOD_LABEL, invoiceStatus, type InvoiceStatus } from '@/control-center/approved/state/moneyData'
import { quoteTotals } from '@/control-center/approved/state/salesData'
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
    reviseInvoice,
    voidInvoice,
    voidPayment,
    emailSendingFor,
  } = useAppState()
  const [paymentSheet, setPaymentSheet] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidPaymentId, setVoidPaymentId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftEdit, setDraftEdit] = useState({ invoiceId: '', amount: '', description: '', reason: '' })

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
  const sourceBreakdown = quote
    ? quoteTotals(quote)
    : invoice.amountSource === 'TICKET' && tickets[0]
      ? ticketTotals(tickets[0])
      : null
  const invoiceSubtotal = invoice.subtotalAmount ?? invoice.amount
  const editAmount = draftEdit.invoiceId === invoice.id ? draftEdit.amount : String(invoiceSubtotal)
  const editDescription = draftEdit.invoiceId === invoice.id ? draftEdit.description : invoice.description
  const editReason = draftEdit.invoiceId === invoice.id ? draftEdit.reason : ''
  const setEdit = (values: Partial<typeof draftEdit>) => setDraftEdit((current) => ({
    invoiceId: invoice.id,
    amount: current.invoiceId === invoice.id ? current.amount : String(invoiceSubtotal),
    description: current.invoiceId === invoice.id ? current.description : invoice.description,
    reason: current.invoiceId === invoice.id ? current.reason : '',
    ...values,
  }))

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
                    : invoice.amountSource === 'QUOTE'
                      ? 'The accepted Quote snapshot is the commercial source. Tickets are delivery proof and never replace this figure.'
                      : 'The agreed amount from the direct job. Tickets are delivery proof and never replace this figure.'}
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
              {Number(invoice.processingFeeAmount ?? 0) > 0 && (
                <div className="grid gap-3 rounded-panel border border-white/[0.08] bg-canvas/25 p-4 sm:grid-cols-3">
                  <Field label="Invoice subtotal" value={usdExact(invoiceSubtotal)} />
                  <Field label={`Processing fee ${formatTaxRate(invoice.processingFeeRate ?? 0)}`} value={usdExact(invoice.processingFeeAmount ?? 0)} />
                  <Field label="Invoice total" value={usdExact(invoice.amount)} />
                </div>
              )}
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
                    <span className={cn(
                      'w-[80px] shrink-0 font-display display-tight text-[18px]',
                      ticket.status === 'VOID'
                        ? 'text-idle line-through'
                        : ticket.sync === 'PENDING'
                          ? 'text-warn'
                          : 'text-mt-red',
                    )}>
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

          {sourceBreakdown && (
            <Panel title="Source breakdown">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Materials" value={usdExact(sourceBreakdown.materials)} />
                {sourceBreakdown.custom > 0 && <Field label="Custom work" value={usdExact(sourceBreakdown.custom)} />}
                <Field label="Delivery" value={usdExact(sourceBreakdown.delivery)} />
                <Field label={`Tax ${formatTaxRate(sourceBreakdown.taxRate)}`} value={usdExact(sourceBreakdown.tax)} />
                <Field label="Source subtotal" value={usdExact(sourceBreakdown.total)} />
                {Number(invoice.processingFeeAmount ?? 0) > 0 && (
                  <Field label={`Processing fee ${formatTaxRate(invoice.processingFeeRate ?? 0)}`} value={usdExact(invoice.processingFeeAmount ?? 0)} />
                )}
                <Field label="Invoice total" value={usdExact(invoice.amount)} />
              </div>
              <p className="mt-4 text-[13px] leading-snug text-cc-muted">
                {invoice.amountSource === 'QUOTE'
                  ? 'Snapshot from the accepted Quote. A draft edit changes only this Invoice and records a reason.'
                  : 'Snapshot from the finalized standalone Ticket.'}
              </p>
            </Panel>
          )}

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
                          : `Received ${stamp(payment.receivedAt)}, ${payment.confirmedBy === 'PROCESSOR' ? 'verified by Stripe' : 'confirmed by a person'}`}
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
              line={invoice.amount > 0
                ? 'Review it, then send the bill. Sending sets the due date from the current business setting.'
                : 'This direct Job has no confirmed amount yet. Enter the agreed Invoice amount before sending.'}
              action={
                <>
                  <PrimaryButton disabled={emailSendingFor === invoice.id || invoice.amount <= 0} tone="onSolid" onClick={() => sendInvoice(invoice.id)}>
                    {emailSendingFor === invoice.id ? 'Sending…' : 'Send Invoice'}
                  </PrimaryButton>
                  <SecondaryButton tone="onSolid" onClick={() => setEditingDraft((open) => !open)}>
                    {editingDraft ? 'Close Edit' : 'Edit Draft'}
                  </SecondaryButton>
                </>
              }
            />
          )}

          {status === 'DRAFT' && editingDraft && (
            <Panel title="Edit draft">
              <div className="space-y-4">
                <TextField
                  label={Number(invoice.processingFeeRate ?? 0) > 0 ? 'Invoice subtotal' : 'Invoice amount'}
                  inputMode="decimal"
                  value={editAmount}
                  onChange={(value) => setEdit({ amount: value })}
                  hint={Number(invoice.processingFeeRate ?? 0) > 0 ? `The snapshotted ${formatTaxRate(invoice.processingFeeRate ?? 0)} processing fee is recalculated from this subtotal.` : undefined}
                />
                <TextArea label="Description" rows={3} value={editDescription} onChange={(value) => setEdit({ description: value })} />
                <TextArea label="Reason for change" rows={2} value={editReason} onChange={(value) => setEdit({ reason: value })} placeholder="Confirmed agreed amount with customer" />
                <PrimaryButton
                  disabled={savingDraft || !Number.isFinite(Number(editAmount)) || Number(editAmount) <= 0 || !editDescription.trim() || !editReason.trim()}
                  onClick={async () => {
                    setSavingDraft(true)
                    try {
                      await reviseInvoice(invoice.id, { amount: Number(editAmount), description: editDescription.trim(), reason: editReason.trim() })
                      setEditingDraft(false)
                      setDraftEdit({ invoiceId: '', amount: '', description: '', reason: '' })
                      toast.success('Draft invoice updated.')
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Draft invoice could not be updated.')
                    } finally {
                      setSavingDraft(false)
                    }
                  }}
                >
                  {savingDraft ? 'Saving…' : 'Save Draft'}
                </PrimaryButton>
              </div>
            </Panel>
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
                  <SecondaryButton disabled={emailSendingFor === invoice.id} tone="onSolid" onClick={() => resendInvoice(invoice.id)}>
                    {emailSendingFor === invoice.id ? 'Sending…' : 'Resend Invoice'}
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
              <div className="space-y-3">
                <Field label="Email" value={customer.email || 'Email required before sending'} />
                <QuietButton size="sm" onClick={() => navigate(`/admin/customers/${customer.id}`)}>
                  Open {customer.name}
                </QuietButton>
              </div>
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
