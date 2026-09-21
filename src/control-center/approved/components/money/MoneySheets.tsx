import { useEffect, useMemo, useState } from 'react'
import { manualPaymentMath } from '@/control-center/manualPayment'
import { FileUp, Sparkles } from 'lucide-react'
import { PrimaryButton, SecondaryButton } from '@/control-center/approved/components/ui/Button'
import { SelectField, TextArea, TextField } from '@/control-center/approved/components/ui/Field'
import { Sheet } from '@/control-center/approved/components/shell/Sheet'
import { usd, usdExact } from '@/control-center/approved/lib/format'
import { useAppState } from '@/control-center/approved/state/AppState'
import { dateKey, parseDateKey } from '@/control-center/approved/state/jobsData'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  isOpen,
  type PaymentMethod,
} from '@/control-center/approved/state/moneyData'

/**
 * Record Payment.
 * A person records money that actually arrived. The AI never does this, and a
 * customer saying they paid is never enough on its own.
 */
export function RecordPaymentSheet({
  open,
  onClose,
  invoiceId,
}: {
  open: boolean
  onClose: () => void
  invoiceId?: string
}) {
  const { invoices, payments, customerById, invoiceById, recordPayment } = useAppState()
  const openInvoices = useMemo(() => invoices.filter((invoice) => isOpen(invoice)), [invoices])

  const [selected, setSelected] = useState(invoiceId ?? openInvoices[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('ZELLE')
  const [date, setDate] = useState(dateKey(new Date()))
  const [note, setNote] = useState('')
  const [fee, setFee] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())

  const invoice = invoiceById(selected)

  useEffect(() => {
    if (!open) return
    const next = invoiceId ?? openInvoices[0]?.id ?? ''
    setSelected(next)
    setMethod('ZELLE')
    setDate(dateKey(new Date()))
    setNote('')
    setError('')
    setRequestId(crypto.randomUUID())
  // A live refresh must not overwrite staff's in-progress payment entry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, open])

  useEffect(() => {
    if (!open || !invoice) return
    const prior = payments.filter(p => p.invoiceId === invoice.id && !p.voidedAt)
    const initialFee = prior.some(p => p.confirmedBy === 'PROCESSOR') ? invoice.processingFeeAmount ?? 0 : 0
    setFee(String(initialFee))
    setAmount(String(Math.max(0, manualPaymentMath(invoice, prior.reduce((n,p) => n+p.amount,0), initialFee, 0).outstanding)))
    setRequestId(crypto.randomUUID())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, open])

  const value = Number(amount) || 0
  const paid = payments.filter(p => p.invoiceId === selected && !p.voidedAt).reduce((n,p) => n+p.amount,0)
  const math = invoice ? manualPaymentMath(invoice, paid, Number(fee), value) : null
  const valid = Boolean(math?.valid) && Boolean(fee.trim()) && !saving

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Money that came in"
      title="Record payment"
      footer={
        <div className="space-y-3">
          <PrimaryButton
            fullWidth
            disabled={!valid}
            onClick={async () => {
              if (!invoice) return
              setSaving(true); setError('')
              try { await recordPayment({
                invoiceId: invoice.id,
                amount: value,
                method,
                receivedAt: parseDateKey(date).getTime(),
                note,
                processingFee: Number(fee), requestId, expectedTotal: invoice.amount,
              })
              onClose()
              } catch (err) { setError(err instanceof Error ? err.message : 'Payment could not be recorded') }
              finally { setSaving(false) }
            }}
          >
            {saving ? 'Saving payment…' : 'Confirm Payment'}
          </PrimaryButton>
          <p className="text-[13px] leading-snug text-cc-muted">
            Confirm only money you verified was received. Partial payments leave the remaining balance open.
          </p>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        </div>
      }
    >
      <div className="space-y-5 p-5">
        {openInvoices.length === 0 ? (
          <p className="text-[15px] text-cc-muted">Nothing is open right now.</p>
        ) : (
          <>
            <SelectField
              label="Invoice"
              value={selected}
              onChange={setSelected}
              options={openInvoices.map((entry) => entry.id)}
              renderOption={(id) => {
                const entry = invoices.find((invoice) => invoice.id === id)
                if (!entry) return id
                return `${entry.number}, ${customerById(entry.customerId)?.name ?? ''}, ${usd(entry.amount)}`
              }}
            />

            {invoice?.claimedPaid && (
              <div className="rounded-panel border border-warn/40 bg-warn/10 p-4 text-[15px] leading-snug text-warn">
                The customer said {PAYMENT_METHOD_LABEL[invoice.claimedPaid.method]} was sent.
                That claim did nothing on its own. Recording it here is what makes it real.
              </div>
            )}

            <TextField label="Processing fee ($)" inputMode="decimal" value={fee} onChange={next => {
              const full = math && Math.abs(value - math.outstanding) < 0.005
              setFee(next)
              if (full && invoice) setAmount(String(Math.max(0, manualPaymentMath(invoice,paid,Number(next),0).outstanding)))
            }} hint="Invoice surcharge for this manual payment. Normally $0; this does not change Stripe processor fees." />
            <TextField label="Amount actually received ($)" inputMode="decimal" value={amount} onChange={setAmount} />
            {math && <div className="rounded-xl border border-line bg-raised p-4 text-sm space-y-2" aria-live="polite">
              <p>Agreed amount: {usdExact(math.subtotal)}</p><p>Invoice total with fee: {usdExact(math.total)}</p>
              <p>Already paid: {usdExact(paid)}</p><p>Balance after this payment: {usdExact(math.remaining)}</p>
            </div>}
            <SelectField
              label="Method"
              value={method}
              onChange={(value) => setMethod(value as PaymentMethod)}
              options={PAYMENT_METHODS}
              renderOption={(entry) => PAYMENT_METHOD_LABEL[entry as PaymentMethod]}
            />
            <TextField label="Date received" type="date" value={date} onChange={setDate} />
            <TextArea
              label="Note"
              value={note}
              onChange={setNote}
              rows={2}
              placeholder="Optional"
            />
          </>
        )}
      </div>
    </Sheet>
  )
}

/** Hourly worker pay. Hours times rate, confirmed by a person. No payroll. */
export function HourlyPaySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workers, addHourlyWorkerPay } = useAppState()
  // Memoised. A fresh array every render would re-run the reset effect and wipe
  // whatever was being typed.
  const hourly = useMemo(
    () => workers.filter((worker) => worker.payType === 'HOURLY' && worker.isActive),
    [workers],
  )

  const [workerId, setWorkerId] = useState(hourly[0]?.id ?? '')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [hours, setHours] = useState('')
  const [rate, setRate] = useState(String(hourly[0]?.hourlyRate ?? 0))

  useEffect(() => {
    if (!open) return
    const start = new Date()
    start.setDate(start.getDate() - 6)
    setWorkerId(hourly[0]?.id ?? '')
    setPeriodStart(dateKey(start))
    setPeriodEnd(dateKey(new Date()))
    setHours('')
    setRate(String(hourly[0]?.hourlyRate ?? 0))
  }, [hourly, open])

  useEffect(() => {
    const worker = workers.find((entry) => entry.id === workerId)
    if (worker?.hourlyRate) setRate(String(worker.hourlyRate))
  }, [workerId, workers])

  const total = (Number(hours) || 0) * (Number(rate) || 0)
  const valid = Boolean(workerId) && total > 0 && Boolean(periodStart) && Boolean(periodEnd)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Worker pay"
      title="Hourly pay"
      footer={
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-cc-muted">
              Total
            </div>
            <div className="font-display display-tight tnum text-[30px]">
              {usdExact(total)}
            </div>
          </div>
          <PrimaryButton
            className="shrink-0"
            disabled={!valid}
            onClick={() => {
              addHourlyWorkerPay({
                workerId,
                periodStart,
                periodEnd,
                hours: Number(hours),
                rate: Number(rate),
              })
              onClose()
            }}
          >
            Confirm
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        <SelectField
          label="Worker"
          value={workerId}
          onChange={setWorkerId}
          options={hourly.map((worker) => worker.id)}
          renderOption={(id) => workers.find((worker) => worker.id === id)?.name ?? id}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Period start"
            type="date"
            value={periodStart}
            onChange={setPeriodStart}
          />
          <TextField label="Period end" type="date" value={periodEnd} onChange={setPeriodEnd} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Hours" value={hours} onChange={setHours} inputMode="decimal" />
          <TextField label="Rate" value={rate} onChange={setRate} inputMode="decimal" />
        </div>
      </div>
    </Sheet>
  )
}

/**
 * Driver pay from the existing Excel invoice.
 * AI reads the file and fills the fields in. It cannot decide what the driver is
 * owed and it cannot confirm the pay, a person does both.
 */
export function DriverInvoiceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workers, addDriverWorkerPay } = useAppState()
  const drivers = useMemo(
    () => workers.filter((worker) => worker.isDriver && worker.isActive),
    [workers],
  )

  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [workerId, setWorkerId] = useState(drivers[0]?.id ?? '')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [amount, setAmount] = useState('')

  useEffect(() => {
    if (open) return
    setFile(null)
    setFileUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    setAmount('')
  }, [open])

  const onPick = (picked: File | null) => {
    if (!picked) return
    setFile(picked)
    setFileUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(picked)
    })
    // Stand in for the extraction pass. The real system reads the file itself.
    const start = new Date()
    start.setDate(start.getDate() - 6)
    setWorkerId(drivers[0]?.id ?? '')
    setPeriodStart(dateKey(start))
    setPeriodEnd(dateKey(new Date()))
    setAmount('1180')
  }

  const value = Number(amount) || 0
  const valid = Boolean(file) && Boolean(workerId) && value > 0

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Worker pay"
      title="Driver invoice"
      footer={
        <div className="space-y-3">
          <PrimaryButton
            fullWidth
            disabled={!valid}
            onClick={() => {
              addDriverWorkerPay({
                workerId,
                periodStart,
                periodEnd,
                amount: value,
                attachmentName: file?.name ?? 'driver-invoice',
              })
              onClose()
            }}
          >
            Confirm pay
          </PrimaryButton>
          <p className="text-[13px] leading-snug text-cc-muted">
            The original file stays attached to the pay record.
          </p>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        {!file ? (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-panel border border-dashed border-line bg-raised px-6 py-10 text-center transition-colors hover:border-ice/40">
            <FileUp className="h-7 w-7 text-ice" strokeWidth={1.8} />
            <span className="mt-3 font-label text-[14px] font-semibold uppercase tracking-[0.12em] text-ink">
              Add the driver invoice
            </span>
            <span className="mt-1.5 text-[14px] text-cc-muted">
              A photo, a screenshot, or the spreadsheet itself
            </span>
            <input
              type="file"
              accept="image/*,.pdf,.xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => onPick(event.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-raised px-4 py-3">
              <span className="min-w-0 truncate text-[15px] text-ink">{file.name}</span>
              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 font-label text-[12px] font-semibold uppercase tracking-[0.12em] text-ice"
                >
                  View original
                </a>
              )}
            </div>

            <div className="rounded-panel border border-ice/30 bg-ice/10 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-ice" strokeWidth={2.2} />
                <span className="font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-ice">
                  Read from the file
                </span>
              </div>
              <p className="mt-2 text-[14px] leading-snug text-cc-muted">
                Check these against the original before you confirm. The AI reads the
                numbers, it does not decide them.
              </p>
            </div>

            <SelectField
              label="Worker"
              value={workerId}
              onChange={setWorkerId}
              options={drivers.map((worker) => worker.id)}
              renderOption={(id) => workers.find((worker) => worker.id === id)?.name ?? id}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Period start"
                type="date"
                value={periodStart}
                onChange={setPeriodStart}
              />
              <TextField
                label="Period end"
                type="date"
                value={periodEnd}
                onChange={setPeriodEnd}
              />
            </div>
            <TextField
              label="Detected total"
              value={amount}
              onChange={setAmount}
              inputMode="decimal"
            />
            <SecondaryButton size="sm" onClick={() => onPick(null)}>
              Use a different file
            </SecondaryButton>
          </>
        )}
      </div>
    </Sheet>
  )
}
