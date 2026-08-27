import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  DriverInvoiceSheet,
  HourlyPaySheet,
  RecordPaymentSheet,
} from '@/control-center/approved/components/money/MoneySheets'
import { VoidReasonSheet } from '@/control-center/approved/components/money/VoidReasonSheet'
import { PrimaryButton, QuietButton, SecondaryButton } from '@/control-center/approved/components/ui/Button'
import { NumberModule } from '@/control-center/approved/components/ui/NumberModule'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { SegmentControl } from '@/control-center/approved/components/ui/SegmentControl'
import { EmptyState, SkeletonNumber } from '@/control-center/approved/components/ui/States'
import { StatusPill, type PillTone } from '@/control-center/approved/components/ui/StatusPill'
import { cn } from '@/control-center/approved/lib/cn'
import { splitMoney, usd, usdExact } from '@/control-center/approved/lib/format'
import { useAppState } from '@/control-center/approved/state/AppState'
import { PERIOD_LABELS, type Period } from '@/control-center/approved/state/mockData'
import {
  PAYMENT_METHOD_LABEL,
  invoiceStatus,
  type InvoiceStatus,
} from '@/control-center/approved/state/moneyData'

type Mode = 'INVOICES' | 'PAYMENTS' | 'WORKER_PAY'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7D', label: '7 Days' },
  { value: 'MTD', label: 'MTD' },
  { value: 'LAST_MONTH', label: 'Last Month' },
]

const INVOICE_TONE: Record<InvoiceStatus, PillTone> = {
  DRAFT: 'neutral',
  SENT: 'ice',
  OVERDUE: 'now',
  PAID: 'ok',
  VOID: 'idle',
}

const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  OVERDUE: 'Overdue',
  PAID: 'Paid',
  VOID: 'Void',
}

function shortDate(at: number): string {
  return new Date(at)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase()
}

function dueLabel(dueAt: number | undefined, status: InvoiceStatus): string {
  if (!dueAt) return 'Not sent yet'
  const days = Math.round((dueAt - Date.now()) / (24 * 60 * 60 * 1000))
  if (status === 'PAID') return 'Settled'
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} overdue`
  if (days === 0) return 'Due today'
  return `Due in ${days} ${days === 1 ? 'day' : 'days'}`
}

export function Money() {
  const [mode, setMode] = useState<Mode>('INVOICES')
  const [paymentSheet, setPaymentSheet] = useState(false)

  return (
    <div className="space-y-5">
      <MoneyOverview />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentControl
          options={[
            { value: 'INVOICES' as Mode, label: 'Invoices' },
            { value: 'PAYMENTS' as Mode, label: 'Payments' },
            { value: 'WORKER_PAY' as Mode, label: 'Worker Pay' },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode !== 'WORKER_PAY' && (
          <PrimaryButton
            onClick={() => setPaymentSheet(true)}
            icon={<Plus className="h-5 w-5" strokeWidth={2.6} />}
          >
            Record Payment
          </PrimaryButton>
        )}
      </div>

      {mode === 'INVOICES' && <InvoiceList />}
      {mode === 'PAYMENTS' && <PaymentList />}
      {mode === 'WORKER_PAY' && <WorkerPay />}

      <RecordPaymentSheet open={paymentSheet} onClose={() => setPaymentSheet(false)} />
    </div>
  )
}

/** Large financial typography, white figures, colour only where it means something. */
function MoneyOverview() {
  const { money, period, setPeriod, moneyLoading } = useAppState()
  const collected = splitMoney(money.collected)
  const outstanding = splitMoney(money.outstanding)
  const overdue = splitMoney(money.overdue)
  const workerPay = splitMoney(money.workerPay)

  return (
    <Panel
      title="Money"
      right={
        <SegmentControl
          options={PERIOD_OPTIONS}
          value={period}
          onChange={setPeriod}
          size="sm"
        />
      }
    >
      {moneyLoading ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 lg:grid-cols-4">
          <SkeletonNumber size="xl" className="col-span-2 lg:col-span-1" />
          <SkeletonNumber size="lg" />
          <SkeletonNumber size="md" />
          <SkeletonNumber size="md" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 lg:grid-cols-[1.25fr_1fr_0.9fr_0.9fr] lg:gap-0 lg:divide-x lg:divide-line">
          <NumberModule
            className="col-span-2 lg:col-span-1 lg:pr-8"
            label="Collected"
            symbol={collected.symbol}
            value={collected.amount}
            size="xl"
            sub={`${PERIOD_LABELS[period]}, ${money.collectedCount} ${money.collectedCount === 1 ? 'payment' : 'payments'}`}
          />
          <NumberModule
            className="lg:px-8"
            label="Outstanding"
            symbol={outstanding.symbol}
            value={outstanding.amount}
            size="lg"
            sub={`${money.outstandingCount} open right now`}
          />
          <NumberModule
            className="lg:px-8"
            label="Overdue"
            symbol={overdue.symbol}
            value={overdue.amount}
            size="md"
            accent={money.overdue > 0 ? 'red' : 'muted'}
            sub={`${money.overdueCount} past due`}
          />
          <NumberModule
            className="lg:pl-8"
            label="Worker Pay"
            symbol={workerPay.symbol}
            value={workerPay.amount}
            size="md"
            accent="muted"
            sub={`${money.workerCount} ${money.workerCount === 1 ? 'worker' : 'workers'}`}
          />
        </div>
      )}
    </Panel>
  )
}

function InvoiceList() {
  const { invoices, customerById } = useAppState()
  const navigate = useNavigate()
  const sorted = [...invoices].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <Panel padded={false} title={`${sorted.length} invoices`}>
      {sorted.length === 0 ? (
        <div className="border-t border-line">
          <EmptyState
            title="No invoices yet"
            line="A completed job becomes an invoice draft for you to review before it goes out."
          />
        </div>
      ) : (
        <div className="divide-y divide-line border-t border-line">
          {sorted.map((invoice) => {
            const status = invoiceStatus(invoice)
            const customer = customerById(invoice.customerId)
            return (
              <button
                key={invoice.id}
                type="button"
                onClick={() => navigate(`/admin/money/invoices/${invoice.id}`)}
                className={cn(
                  'row-hover flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-white/[0.04] active:bg-raised',
                  status === 'VOID' && 'opacity-55',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-semibold text-ink">
                      {customer?.name ?? 'Unknown'}
                    </span>
                    <StatusPill tone={INVOICE_TONE[status]} size="sm">
                      {INVOICE_LABEL[status]}
                    </StatusPill>
                    {invoice.disputed && (
                      <StatusPill tone="warn" size="sm">
                        Disputed
                      </StatusPill>
                    )}
                    {invoice.claimedPaid && (
                      <StatusPill tone="warn" size="sm">
                        Verify
                      </StatusPill>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[14px] text-cc-muted">
                    {invoice.description}
                  </span>
                  <span className="mt-0.5 block font-label text-[12px] uppercase tracking-[0.08em] text-idle">
                    Invoice {invoice.number}
                    <span className="px-1.5">/</span>
                    {dueLabel(invoice.dueAt, status)}
                  </span>
                </span>
                <span className="shrink-0 font-display display-tight tnum text-[22px]">
                  {usd(invoice.amount)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

function PaymentList() {
  const { payments, customerById, invoiceById } = useAppState()
  const navigate = useNavigate()
  const sorted = [...payments].sort((a, b) => b.receivedAt - a.receivedAt)

  return (
    <Panel padded={false} title={`${sorted.length} payments`}>
      {sorted.length === 0 ? (
        <div className="border-t border-line">
          <EmptyState title="Nothing recorded yet" line="Payments show up here once they land." />
        </div>
      ) : (
        <div className="divide-y divide-line border-t border-line">
          {sorted.map((payment) => {
            const invoice = invoiceById(payment.invoiceId)
            return (
              <button
                key={payment.id}
                type="button"
                onClick={() =>
                  invoice ? navigate(`/admin/money/invoices/${invoice.id}`) : undefined
                }
                className="row-hover flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.04]"
              >
                <span className="w-[68px] shrink-0 font-label text-[12px] uppercase tracking-[0.08em] text-idle">
                  {shortDate(payment.receivedAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold text-ink">
                    {customerById(payment.customerId)?.name ?? 'Unknown'}
                  </span>
                  <span className="mt-0.5 block font-label text-[12px] uppercase tracking-[0.08em] text-cc-muted">
                    {PAYMENT_METHOD_LABEL[payment.method]}
                    {invoice && (
                      <>
                        <span className="px-1.5 text-idle">/</span>
                        Invoice {invoice.number}
                      </>
                    )}
                  </span>
                </span>
                <span className="shrink-0 font-display display-tight tnum text-[22px] text-ok">
                  {usd(payment.amount)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

function WorkerPay() {
  const { workers, workerPaymentsFor, confirmWorkerPayDetails, markWorkerPayPaid, voidWorkerPayment } =
    useAppState()
  const [hourlySheet, setHourlySheet] = useState(false)
  const [driverSheet, setDriverSheet] = useState(false)
  const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null)

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2.5">
        <PrimaryButton onClick={() => setHourlySheet(true)}>Record Hourly Pay</PrimaryButton>
        <SecondaryButton onClick={() => setDriverSheet(true)}>
          Upload Driver Invoice
        </SecondaryButton>
      </div>

      {workers.map((worker) => {
        const records = workerPaymentsFor(worker.id)
        // Only what was actually paid. Entered and confirmed amounts are not pay yet.
        const monthTotal = records
          .filter(
            (entry) =>
              entry.status === 'PAID' &&
              !entry.voidedAt &&
              (entry.paidAt ?? 0) >= monthStart.getTime(),
          )
          .reduce((sum, entry) => sum + entry.amount, 0)

        return (
          <Panel
            key={worker.id}
            padded={false}
            title={worker.name}
            right={
              <div className="flex items-center gap-3">
                <StatusPill tone="neutral" size="sm">
                  {worker.payType === 'HOURLY' ? `${usd(worker.hourlyRate ?? 0)} an hour` : 'By load'}
                </StatusPill>
                <span className="font-display display-tight tnum text-[24px]">
                  {usd(monthTotal)}
                </span>
              </div>
            }
          >
            {records.length === 0 ? (
              <div className="border-t border-line px-5 py-4 text-[15px] text-cc-muted">
                Nothing recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-line border-t border-line">
                {records.map((entry) => (
                  <div key={entry.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                    <span className="min-w-0 flex-1">
                      <span className="block font-label text-[13px] uppercase tracking-[0.08em] text-ink">
                        {entry.periodStart} to {entry.periodEnd}
                      </span>
                      <span className="mt-0.5 block text-[14px] text-cc-muted">
                        {entry.hours !== undefined
                          ? `${entry.hours} hours at ${usd(entry.rate ?? 0)}`
                          : `From ${entry.attachmentName ?? 'the driver invoice'}`}
                      </span>
                    </span>

                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      {entry.voidedAt ? (
                        <StatusPill tone="idle" size="sm" className="shrink-0">
                          Void
                        </StatusPill>
                      ) : entry.status === 'PENDING' ? (
                        <>
                        <StatusPill tone="warn" size="sm">
                          {entry.source === 'DRIVER_INVOICE' ? 'Check the numbers' : 'Not paid'}
                        </StatusPill>
                        {entry.source === 'DRIVER_INVOICE' ? (
                          <SecondaryButton
                            size="sm"
                            onClick={() => confirmWorkerPayDetails(entry.id)}
                          >
                            Confirm details
                          </SecondaryButton>
                        ) : (
                          <SecondaryButton size="sm" onClick={() => markWorkerPayPaid(entry.id)}>
                            Mark paid
                          </SecondaryButton>
                        )}
                        </>
                      ) : entry.status === 'CONFIRMED' ? (
                        <>
                        <StatusPill tone="warn" size="sm">
                          Not paid
                        </StatusPill>
                        <SecondaryButton size="sm" onClick={() => markWorkerPayPaid(entry.id)}>
                          Mark paid
                        </SecondaryButton>
                        </>
                      ) : (
                        <StatusPill tone="ok" size="sm" className="shrink-0">
                          Paid
                        </StatusPill>
                      )}

                      {!entry.voidedAt && (
                        <QuietButton size="sm" onClick={() => setVoidingPaymentId(entry.id)}>
                          Void
                        </QuietButton>
                      )}
                    </div>

                    <span className="shrink-0 font-display display-tight tnum text-[20px] sm:w-[86px] sm:text-right">
                      {usdExact(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )
      })}

      <p className="px-1 text-[13px] leading-snug text-cc-muted">
        Worker pay is a record, not payroll. A record only counts once it is marked paid.
        There are no worker logins, no time clock and no tax handling here.
      </p>

      <HourlyPaySheet open={hourlySheet} onClose={() => setHourlySheet(false)} />
      <DriverInvoiceSheet open={driverSheet} onClose={() => setDriverSheet(false)} />
      <VoidReasonSheet
        open={voidingPaymentId !== null}
        onClose={() => setVoidingPaymentId(null)}
        onConfirm={(reason) => {
          if (voidingPaymentId) voidWorkerPayment(voidingPaymentId, reason)
        }}
        title="Void worker payment"
        line="The pay record stays in history and stops contributing to paid Worker Pay totals."
        placeholder="Wrong worker, amount or pay period"
        confirmLabel="Void this worker payment"
      />
    </div>
  )
}
