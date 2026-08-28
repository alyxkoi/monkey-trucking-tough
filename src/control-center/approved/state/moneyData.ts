/**
 * Money.
 *
 * Invoice is the request for money. Payment is the record of money actually
 * received. They are separate concepts and neither one is a Ticket.
 *
 * This is not bookkeeping. There is no profit, no expenses, no reconciliation.
 * The only questions it answers are who owes us, what came in, and what the
 * workers were paid.
 */

/** Who made a change to a financial record, and why. */
export type FinancialChange = {
  at: number
  actor: string
  note: string
}

/** The only operator in v1. Users and Access covers Salvador and the admin. */
export const CURRENT_USER = 'Salvador'

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'OVERDUE' | 'PAID' | 'VOID'

/**
 * Where the invoice amount came from.
 *
 * JOB and QUOTE: the agreed amount is the source of truth and the tickets ride
 * along as delivery proof only. Ticket totals never drive the invoice, because
 * custom work can be part of the same job.
 *
 * TICKET: a finalised standalone ticket with no job and no quote behind it. That
 * is a direct material order, so the ticket's own grand total is the amount.
 */
export type InvoiceAmountSource = 'JOB' | 'QUOTE' | 'TICKET'

export type Invoice = {
  id: string
  number: string
  customerId: string
  jobId?: string
  quoteId?: string
  /** Delivery proof attached to the invoice. Never summed into the amount for a job. */
  ticketIds: string[]
  description: string
  /** Original agreed/source amount before the snapshotted Invoice processing fee. */
  subtotalAmount?: number
  processingFeeRate?: number
  processingFeeAmount?: number
  /** Authoritative amount due, including the snapshotted processing fee. */
  amount: number
  amountSource: InvoiceAmountSource
  status: InvoiceStatus
  createdAt: number
  issuedAt?: number
  dueAt?: number
  paidAt?: number
  voidedAt?: number
  voidReason?: string
  /** The customer says the amount is wrong. Chasing stops until a human settles it. */
  disputed?: boolean
  disputeNote?: string
  /**
   * The customer says they sent money. This is a claim, not a payment.
   * Nothing is ever marked paid from it, a human has to confirm it landed.
   */
  claimedPaid?: { at: number; method: PaymentMethod; note: string }
  /** Automated reminders that already went out. */
  followUps: { at: number; label: string }[]
  /** Every void or correction, with who and when. Financial records never vanish. */
  history: FinancialChange[]
  voidedBy?: string
}

export type PaymentMethod = 'ACH' | 'CARD' | 'ZELLE' | 'APPLE_PAY' | 'CHECK' | 'OTHER' | 'STRIPE'

export const PAYMENT_METHODS: PaymentMethod[] = [
  'ACH',
  'CARD',
  'ZELLE',
  'APPLE_PAY',
  'CHECK',
  'OTHER',
]

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  ACH: 'ACH',
  CARD: 'Card',
  ZELLE: 'Zelle',
  APPLE_PAY: 'Apple Pay',
  CHECK: 'Check',
  OTHER: 'Other',
  STRIPE: 'Stripe',
}

export type Payment = {
  id: string
  invoiceId: string
  customerId: string
  amount: number
  method: PaymentMethod
  receivedAt: number
  recordedAt: number
  /** A processor can confirm itself. Everything else needs a person. */
  confirmedBy: 'HUMAN' | 'PROCESSOR'
  note: string
  /** Corrections and voids, never a silent delete. */
  history: FinancialChange[]
  voidedAt?: number
  voidReason?: string
  voidedBy?: string
}

/** Workers are records, not users. No logins, no portal, no time clock. */
export type Worker = {
  id: string
  name: string
  payType: 'HOURLY' | 'BY_LOAD'
  hourlyRate?: number
  isDriver: boolean
  isActive: boolean
  notes: string
}

/**
 * Worker pay is only money once someone paid it.
 * PENDING is entered or extracted. CONFIRMED means the detected information was
 * checked, which is all an AI extraction confirmation ever means. PAID is
 * Salvador saying the worker actually got the money, and only PAID counts.
 */
export type WorkerPaymentStatus = 'PENDING' | 'CONFIRMED' | 'PAID'

export type WorkerPayment = {
  id: string
  workerId: string
  periodStart: string
  periodEnd: string
  hours?: number
  rate?: number
  amount: number
  status: WorkerPaymentStatus
  /** DRIVER_INVOICE means the numbers were read off an uploaded file by AI. */
  source: 'MANUAL' | 'DRIVER_INVOICE'
  attachmentName?: string
  createdAt: number
  confirmedAt?: number
  paidAt?: number
  /** Corrections and voids, never a silent delete. */
  history: FinancialChange[]
  voidedAt?: number
  voidReason?: string
  voidedBy?: string
}

/**
 * Worker names are PLACEHOLDERS.
 * The Ticket System Handoff names only Salvador Alvarez as a driver, and the
 * Master Context says there are three workers without naming them. The real
 * roster gets entered in Settings, Workers.
 */
export const WORKERS: Worker[] = [
  {
    id: 'wk-1',
    name: 'Miguel Herrera',
    payType: 'HOURLY',
    hourlyRate: 22,
    isDriver: false,
    isActive: true,
    notes: 'Placeholder name, replace from the real roster.',
  },
  {
    id: 'wk-2',
    name: 'Javier Luna',
    payType: 'HOURLY',
    hourlyRate: 20,
    isDriver: false,
    isActive: true,
    notes: 'Placeholder name, replace from the real roster.',
  },
  {
    id: 'wk-3',
    name: 'Beto Ramos',
    payType: 'BY_LOAD',
    isDriver: true,
    isActive: true,
    notes: 'Paid by loads and routes from the existing Excel invoice.',
  },
]

export const DEFAULT_DUE_DAYS = 3

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const now = Date.now()

function dayLabel(offsetDays: number): string {
  const date = new Date(now + offsetDays * DAY)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    number: '1021',
    customerId: 'cust-5',
    jobId: 'job-17',
    ticketIds: ['tk-1'],
    description: 'Back road base, 3 loads',
    amount: 3669.68,
    amountSource: 'JOB',
    status: 'PAID',
    createdAt: now - 293 * DAY,
    issuedAt: now - 293 * DAY,
    dueAt: now - 290 * DAY,
    paidAt: now - 290 * DAY,
    followUps: [],
    history: [],
  },
  {
    id: 'inv-2',
    number: '1039',
    customerId: 'cust-5',
    jobId: 'job-15',
    ticketIds: ['tk-2'],
    description: 'Driveway apron repair',
    amount: 640,
    amountSource: 'JOB',
    status: 'SENT',
    createdAt: now - 10 * DAY,
    issuedAt: now - 10 * DAY,
    dueAt: now - 7 * DAY,
    claimedPaid: {
      at: now - 5 * HOUR,
      method: 'ZELLE',
      note: 'i sent the zelle yesterday',
    },
    followUps: [
      { at: now - 7 * DAY, label: 'Reminder on the due date' },
      { at: now - 6 * DAY, label: 'Reminder, one day overdue' },
    ],
    history: [],
  },
  {
    id: 'inv-3',
    number: '1042',
    customerId: 'cust-2',
    jobId: 'job-11',
    ticketIds: [],
    description: 'Cut and shape the equipment pad',
    amount: 1150,
    amountSource: 'JOB',
    status: 'SENT',
    createdAt: now - 9 * DAY,
    issuedAt: now - 9 * DAY,
    dueAt: now - 3 * DAY,
    followUps: [
      { at: now - 3 * DAY, label: 'Reminder on the due date' },
      { at: now - 2 * DAY, label: 'Reminder, one day overdue' },
      { at: now - 12 * HOUR, label: 'Final automated reminder' },
    ],
    history: [],
  },
  {
    id: 'inv-4',
    number: '1043',
    customerId: 'cust-11',
    jobId: 'job-9',
    ticketIds: ['tk-5'],
    description: 'Driveway base and topping',
    amount: 4180,
    amountSource: 'JOB',
    status: 'SENT',
    createdAt: now - 2 * DAY,
    issuedAt: now - 2 * DAY,
    dueAt: now + DAY,
    disputed: true,
    disputeNote: 'Says the second load was smaller than what is on the ticket.',
    followUps: [],
    history: [],
  },
  {
    id: 'inv-5',
    number: '1044',
    customerId: 'cust-4',
    jobId: 'job-14',
    ticketIds: ['tk-3'],
    description: 'Base material for the side lot',
    amount: 1690,
    amountSource: 'JOB',
    status: 'PAID',
    createdAt: now - 16 * DAY,
    issuedAt: now - 16 * DAY,
    dueAt: now - 13 * DAY,
    paidAt: now - 12 * DAY,
    followUps: [],
    history: [],
  },
  {
    id: 'inv-6',
    number: '1045',
    customerId: 'cust-12',
    jobId: 'job-13',
    ticketIds: [],
    description: 'Brush and small trees along the fence line',
    amount: 2900,
    amountSource: 'JOB',
    status: 'PAID',
    createdAt: now - 13 * DAY,
    issuedAt: now - 13 * DAY,
    dueAt: now - 10 * DAY,
    paidAt: now - 9 * DAY,
    followUps: [],
    history: [],
  },
  {
    id: 'inv-7',
    number: '1046',
    customerId: 'cust-1',
    jobId: 'job-12',
    ticketIds: ['tk-4'],
    description: 'Three loads of native gravel',
    amount: 3182,
    amountSource: 'JOB',
    status: 'PAID',
    createdAt: now - 9 * DAY,
    issuedAt: now - 9 * DAY,
    dueAt: now - 6 * DAY,
    paidAt: now - 5 * DAY,
    followUps: [],
    history: [],
  },
]

/* Last month, so the Last Month period shows real collected work. */
INVOICES.push(
  {
    id: 'inv-8',
    number: '1037',
    customerId: 'cust-4',
    jobId: 'job-18',
    ticketIds: [],
    description: 'Yard rock for the back lot',
    amount: 2140,
    amountSource: 'JOB',
    status: 'PAID',
    createdAt: now - 52 * DAY,
    issuedAt: now - 52 * DAY,
    dueAt: now - 49 * DAY,
    paidAt: now - 48 * DAY,
    followUps: [],
    history: [],
  },
  {
    id: 'inv-9',
    number: '1038',
    customerId: 'cust-12',
    jobId: 'job-19',
    ticketIds: [],
    description: 'Cut the drainage swale behind the pens',
    amount: 3480,
    amountSource: 'JOB',
    status: 'PAID',
    createdAt: now - 40 * DAY,
    issuedAt: now - 40 * DAY,
    dueAt: now - 37 * DAY,
    paidAt: now - 36 * DAY,
    followUps: [],
    history: [],
  },
)

export const PAYMENTS: Payment[] = [
  {
    id: 'pay-5',
    invoiceId: 'inv-8',
    customerId: 'cust-4',
    amount: 2140,
    method: 'ACH',
    receivedAt: now - 48 * DAY,
    recordedAt: now - 48 * DAY,
    confirmedBy: 'HUMAN',
    note: '',
    history: [],
  },
  {
    id: 'pay-6',
    invoiceId: 'inv-9',
    customerId: 'cust-12',
    amount: 3480,
    method: 'CHECK',
    receivedAt: now - 36 * DAY,
    recordedAt: now - 36 * DAY,
    confirmedBy: 'HUMAN',
    note: '',
    history: [],
  },
  {
    id: 'pay-1',
    invoiceId: 'inv-1',
    customerId: 'cust-5',
    amount: 3669.68,
    method: 'CHECK',
    receivedAt: now - 290 * DAY,
    recordedAt: now - 290 * DAY,
    confirmedBy: 'HUMAN',
    note: '',
    history: [],
  },
  {
    id: 'pay-2',
    invoiceId: 'inv-5',
    customerId: 'cust-4',
    amount: 1690,
    method: 'ACH',
    receivedAt: now - 12 * DAY,
    recordedAt: now - 12 * DAY,
    confirmedBy: 'HUMAN',
    note: '',
    history: [],
  },
  {
    id: 'pay-3',
    invoiceId: 'inv-6',
    customerId: 'cust-12',
    amount: 2900,
    method: 'CHECK',
    receivedAt: now - 9 * DAY,
    recordedAt: now - 9 * DAY,
    confirmedBy: 'HUMAN',
    note: '',
    history: [],
  },
  {
    id: 'pay-4',
    invoiceId: 'inv-7',
    customerId: 'cust-1',
    amount: 3182,
    method: 'CARD',
    receivedAt: now - 5 * DAY,
    recordedAt: now - 5 * DAY,
    confirmedBy: 'HUMAN',
    note: '',
    history: [],
  },
]

export const WORKER_PAYMENTS: WorkerPayment[] = [
  {
    id: 'wp-1',
    workerId: 'wk-1',
    periodStart: dayLabel(-15),
    periodEnd: dayLabel(-9),
    hours: 42,
    rate: 22,
    amount: 924,
    status: 'PAID',
    source: 'MANUAL',
    createdAt: now - 9 * DAY,
    confirmedAt: now - 9 * DAY,
    paidAt: now - 9 * DAY,
    history: [],
  },
  {
    id: 'wp-2',
    workerId: 'wk-2',
    periodStart: dayLabel(-15),
    periodEnd: dayLabel(-9),
    hours: 38,
    rate: 20,
    amount: 760,
    status: 'PAID',
    source: 'MANUAL',
    createdAt: now - 9 * DAY,
    confirmedAt: now - 9 * DAY,
    paidAt: now - 9 * DAY,
    history: [],
  },
  {
    id: 'wp-3',
    workerId: 'wk-3',
    periodStart: dayLabel(-15),
    periodEnd: dayLabel(-9),
    amount: 1340,
    status: 'PAID',
    source: 'DRIVER_INVOICE',
    attachmentName: 'driver-invoice-week-33.jpg',
    createdAt: now - 9 * DAY,
    confirmedAt: now - 8 * DAY,
    paidAt: now - 8 * DAY,
    history: [],
  },
  {
    id: 'wp-4',
    workerId: 'wk-1',
    periodStart: dayLabel(-8),
    periodEnd: dayLabel(-2),
    hours: 40,
    rate: 22,
    amount: 880,
    status: 'PAID',
    source: 'MANUAL',
    createdAt: now - 2 * DAY,
    confirmedAt: now - 2 * DAY,
    paidAt: now - 2 * DAY,
    history: [],
  },
  {
    // Entered and checked, but nobody has been paid yet, so it counts for nothing.
    id: 'wp-5',
    workerId: 'wk-2',
    periodStart: dayLabel(-8),
    periodEnd: dayLabel(-2),
    hours: 36,
    rate: 20,
    amount: 720,
    status: 'CONFIRMED',
    source: 'MANUAL',
    createdAt: now - 2 * DAY,
    confirmedAt: now - 2 * DAY,
    history: [],
  },
  {
    // Read off an uploaded file by AI. The numbers still have to be checked.
    id: 'wp-6',
    workerId: 'wk-3',
    periodStart: dayLabel(-8),
    periodEnd: dayLabel(-2),
    amount: 1180,
    status: 'PENDING',
    source: 'DRIVER_INVOICE',
    attachmentName: 'driver-invoice-week-34.jpg',
    createdAt: now - 6 * HOUR,
    history: [],
  },
]

/* ------------------------------------------------------------------ helpers */

/** OVERDUE is a live fact about the due date, not a stored flag someone forgot to set. */
export function invoiceStatus(invoice: Invoice, at = Date.now()): InvoiceStatus {
  if (invoice.status !== 'SENT') return invoice.status
  if (invoice.dueAt && invoice.dueAt < at) return 'OVERDUE'
  return 'SENT'
}

export function isOpen(invoice: Invoice, at = Date.now()): boolean {
  const status = invoiceStatus(invoice, at)
  return status === 'SENT' || status === 'OVERDUE'
}

export function workerById(id: string): Worker | undefined {
  return WORKERS.find((worker) => worker.id === id)
}

export type MoneyPeriod = '7D' | 'MTD' | 'LAST_MONTH'

export function periodRange(period: MoneyPeriod, at = Date.now()): { start: number; end: number } {
  const nowDate = new Date(at)
  if (period === '7D') return { start: at - 7 * DAY, end: at }
  if (period === 'MTD') {
    return {
      start: new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime(),
      end: at,
    }
  }
  return {
    start: new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1).getTime(),
    end: new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime() - 1,
  }
}

export type CollectedPoint = {
  /** Start of the day this point covers. */
  at: number
  label: string
  /** Running total collected inside the period up to and including this day. */
  value: number
  /** What landed on this day alone. */
  dayValue: number
}

/**
 * The collected line.
 *
 * Built from the same payment records as the Collected total, so the end of the
 * line is always exactly the hero figure. Running total rather than daily bars,
 * because a few payments a week would otherwise be a row of empty columns.
 */
export function collectedSeries(input: {
  period: MoneyPeriod
  payments: Payment[]
  at?: number
}): CollectedPoint[] {
  const at = input.at ?? Date.now()
  const { start, end } = periodRange(input.period, at)

  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const last = new Date(end)
  last.setHours(0, 0, 0, 0)

  const points: CollectedPoint[] = []
  let running = 0

  while (cursor.getTime() <= last.getTime() && points.length < 40) {
    const dayStart = new Date(cursor).setHours(0, 0, 0, 0)
    const dayEnd = new Date(cursor).setHours(23, 59, 59, 999)
    const dayValue = input.payments
      .filter(
        (payment) =>
          !payment.voidedAt &&
          payment.receivedAt >= Math.max(dayStart, start) &&
          payment.receivedAt <= Math.min(dayEnd, end),
      )
      .reduce((sum, payment) => sum + payment.amount, 0)

    running += dayValue
    points.push({
      at: dayStart,
      label: new Date(dayStart)
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        .toUpperCase(),
      value: running,
      dayValue,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return points
}

export type MoneyTotals = {
  collected: number
  collectedCount: number
  /** Current balance, not period scoped. What is owed right now. */
  outstanding: number
  outstandingCount: number
  overdue: number
  overdueCount: number
  workerPay: number
  workerCount: number
}

/**
 * Profit is never computed. The system does not track diesel, maintenance, parts,
 * insurance or any other expense, so any profit figure would be a lie.
 */
export function computeMoney(input: {
  period: MoneyPeriod
  invoices: Invoice[]
  payments: Payment[]
  workerPayments: WorkerPayment[]
  at?: number
}): MoneyTotals {
  const at = input.at ?? Date.now()
  const { start, end } = periodRange(input.period, at)

  const inPeriod = input.payments.filter(
    (payment) => !payment.voidedAt && payment.receivedAt >= start && payment.receivedAt <= end,
  )
  const open = input.invoices.filter((invoice) => isOpen(invoice, at))
  const overdue = open.filter((invoice) => invoiceStatus(invoice, at) === 'OVERDUE')
  // Only money that was actually paid counts. Entered, extracted and confirmed
  // amounts are not worker pay until Salvador says the worker was paid.
  const workerPay = input.workerPayments.filter(
    (entry) =>
      entry.status === 'PAID' &&
      !entry.voidedAt &&
      (entry.paidAt ?? 0) >= start &&
      (entry.paidAt ?? 0) <= end,
  )

  return {
    collected: inPeriod.reduce((sum, payment) => sum + payment.amount, 0),
    collectedCount: inPeriod.length,
    outstanding: open.reduce((sum, invoice) => sum + invoice.amount, 0),
    outstandingCount: open.length,
    overdue: overdue.reduce((sum, invoice) => sum + invoice.amount, 0),
    overdueCount: overdue.length,
    workerPay: workerPay.reduce((sum, entry) => sum + entry.amount, 0),
    workerCount: new Set(workerPay.map((entry) => entry.workerId)).size,
  }
}
