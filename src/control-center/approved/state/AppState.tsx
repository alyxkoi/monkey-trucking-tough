import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import type { Json } from '@/integrations/supabase/types'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import {
  addLeadMessage,
  confirmWorkerPayment,
  completeJobAndPrepareInvoice,
  controlDb,
  createInvoiceFromJob as createInvoiceFromJobRecord,
  createInvoiceFromTicket as createInvoiceFromTicketRecord,
  createJob as createJobRecord,
  createLead as createLeadRecord,
  createQuoteDraft,
  createWorkerPayment,
  findOrCreateCustomer,
  markWorkerPaymentPaid,
  recordPayment as recordPaymentRecord,
  reviseDraftInvoice,
  saveQuoteChanges,
  sendCustomerEmail,
  snoozeAttention as persistSnooze,
  updateJob,
  updateLead,
  updateQuote,
  voidFinancialRecord,
  type ControlData,
  type QuoteDraft,
} from '@/control-center/data'
import { useControlCenter } from '@/control-center/context'
import { useDemoMode } from '@/control-center/demo/DemoMode'
import { QA_FIXTURE_USER_ID } from '@/control-center/demo/constants'
import {
  correctTicket,
  deleteTicketPermanently,
  getQueue,
  saveTicket as saveTicketRecord,
  voidTicket as voidTicketRecord,
  type TicketDraft,
} from '@/lib/admin/tickets'
import { ticketDeleteProtection, type TicketDeleteResult } from '@/control-center/ticketDeletion'
import { effectiveTaxRate, processingFeeFor } from '@/control-center/billing'
import { outputTicketPng, renderTicketPng } from '@/lib/admin/print'
import { deriveAttention, type AttentionItem } from './attention'
import { dateKey, type Job, type JobCategory } from './jobsData'
import {
  computeMoney,
  type Invoice,
  type Payment,
  type PaymentMethod,
  type Worker,
  type WorkerPayment,
} from './moneyData'
import { type Period } from './mockData'
import {
  computeTotals,
  configurePricing,
  deliveryFeePerLoad,
  suggestedDeliveryLoads,
  type CustomLine,
  type DeliverySelection,
  type MaterialLine,
} from './pricing'
import { formatTaxRate, taxRateMultiplier } from '@/lib/tax'
import {
  mapActivities,
  mapCustomers,
  mapInvoices,
  mapJobs,
  mapLeads,
  mapMaterials,
  mapPayments,
  mapQuotes,
  mapTickets,
  mapWorkerPayments,
  mapWorkers,
  deliveryToDatabase,
} from './databaseMap'
import { matchCustomer, quoteTotals, type Activity, type Customer, type Lead, type Quote } from './salesData'
import { configureDrivers, ticketTotals, type Ticket } from './ticketsData'

export type SyncStatus = 'synced' | 'syncing' | 'offline'
export type AttentionOutcome = 'snoozed'
type LastAction = { item: AttentionItem; outcome: AttentionOutcome } | null

export type NewLeadInput = {
  name: string
  phone: string
  email?: string
  source: string
  campaign?: string
  need: string
}

export type ScheduleJobInput = {
  customerId: string
  quoteId?: string
  category: JobCategory
  date: string
  time?: string
  allDay: boolean
  address: string
  description: string
  agreedAmount: number
  notes?: string
}

export type SaveTicketInput = {
  customerId: string
  jobId?: string
  driverId: string
  address: string
  materialLines: MaterialLine[]
  delivery: DeliverySelection
  deliveryLoads: number
  notes: string
}

export type NewLeadResult = {
  leadId: string
  customerId: string
  matchedExisting: boolean
  customerName: string
}

export type AppStateValue = {
  period: Period
  setPeriod: (period: Period) => void
  money: ReturnType<typeof computeMoney>
  pipeline: { newLeads: number; openQuotes: number; openQuoteValue: number; scheduledJobs: number }
  todayJobs: Job[]
  attention: AttentionItem[]
  visibleAttention: AttentionItem[]
  snoozedItems: { item: AttentionItem; returnsAt: number }[]
  openCount: number
  showAllAttention: boolean
  toggleShowAllAttention: () => void
  snoozeAttention: (id: string) => void
  unsnoozeAttention: (id: string) => void
  lastAction: LastAction
  undoLastAction: () => void
  booting: boolean
  moneyLoading: boolean
  sync: SyncStatus
  queued: number
  lastSyncAt: number
  cycleSync: () => void
  newSheetOpen: boolean
  setNewSheetOpen: (open: boolean) => void
  newLeadSheetOpen: boolean
  setNewLeadSheetOpen: (open: boolean) => void
  newJobSheetOpen: boolean
  setNewJobSheetOpen: (open: boolean) => void
  pinnedBarActive: boolean
  setPinnedBarActive: (active: boolean) => void
  customers: Customer[]
  leads: Lead[]
  quotes: Quote[]
  activities: Activity[]
  customerById: (id: string) => Customer | undefined
  leadById: (id: string) => Lead | undefined
  quoteById: (id: string) => Quote | undefined
  leadsForCustomer: (customerId: string) => Lead[]
  quotesForCustomer: (customerId: string) => Quote[]
  activitiesForCustomer: (customerId: string) => Activity[]
  jobs: Job[]
  jobById: (id: string) => Job | undefined
  jobsForDay: (day: string) => Job[]
  jobsForCustomer: (customerId: string) => Job[]
  photoJobsForCustomer: (customerId: string) => Job[]
  unscheduledQuotes: () => Quote[]
  scheduleJob: (input: ScheduleJobInput) => Promise<string>
  rescheduleJob: (jobId: string, when: { date: string; time?: string; allDay: boolean }) => void
  completeJob: (jobId: string) => void
  cancelJob: (jobId: string, reason: string) => void
  startJob: (jobId: string) => void
  updateJobNotes: (jobId: string, notes: string) => void
  tickets: Ticket[]
  ticketById: (id: string) => Ticket | undefined
  ticketsForJob: (jobId: string) => Ticket[]
  ticketsForCustomer: (customerId: string) => Ticket[]
  saveTicket: (input: SaveTicketInput) => Promise<string>
  updateTicket: (ticketId: string, input: SaveTicketInput, note: string) => Promise<void>
  voidTicket: (ticketId: string, reason: string) => void
  deleteTicket: (ticketId: string, confirmation: string, reason: string) => Promise<TicketDeleteResult>
  printTicket: (ticketId: string) => void
  invoices: Invoice[]
  payments: Payment[]
  workers: Worker[]
  workerPayments: WorkerPayment[]
  invoiceById: (id: string) => Invoice | undefined
  invoiceForJob: (jobId: string) => Invoice | undefined
  invoiceForTicket: (ticketId: string) => Invoice | undefined
  paymentsForInvoice: (invoiceId: string) => Payment[]
  workerPaymentsFor: (workerId: string) => WorkerPayment[]
  createInvoiceFromJob: (jobId: string) => Promise<string>
  createInvoiceFromTicket: (ticketId: string) => Promise<string>
  reviseInvoice: (invoiceId: string, input: { amount: number; description: string; reason: string }) => Promise<void>
  sendInvoice: (invoiceId: string) => void
  resendInvoice: (invoiceId: string) => void
  voidInvoice: (invoiceId: string, reason: string) => void
  recordPayment: (input: { invoiceId: string; amount: number; method: PaymentMethod; receivedAt: number; note: string }) => void
  addHourlyWorkerPay: (input: { workerId: string; periodStart: string; periodEnd: string; hours: number; rate: number }) => void
  addDriverWorkerPay: (input: { workerId: string; periodStart: string; periodEnd: string; amount: number; attachmentName: string }) => void
  confirmWorkerPayDetails: (id: string) => void
  markWorkerPayPaid: (id: string) => void
  voidWorkerPayment: (id: string, reason: string) => void
  voidPayment: (paymentId: string, reason: string) => void
  findDuplicate: (phone: string, email?: string) => Customer | undefined
  createLead: (input: NewLeadInput) => Promise<NewLeadResult>
  createCustomer: (input: { name: string; phone: string; email?: string }) => Promise<Customer>
  replyToLead: (leadId: string, text: string) => void
  updateLeadNotes: (leadId: string, notes: string) => void
  updateCustomerNotes: (customerId: string, notes: string) => void
  createQuoteFromLead: (leadId: string) => Promise<string>
  updateQuoteMeta: (quoteId: string, patch: { description?: string; address?: string }) => void
  addMaterialLine: (quoteId: string, materialId: string, options: { isFullLoad: boolean; loads?: number; yards?: number }) => void
  removeMaterialLine: (quoteId: string, lineId: string) => void
  addCustomLine: (quoteId: string, label: string, amount: number) => void
  removeCustomLine: (quoteId: string, lineId: string) => void
  setQuoteDelivery: (quoteId: string, delivery: DeliverySelection) => void
  setQuoteDeliveryLoads: (quoteId: string, deliveryLoads: number) => void
  sendQuote: (quoteId: string) => void
  acceptQuote: (quoteId: string) => void
  declineQuote: (quoteId: string) => void
  communicationReady: boolean
  emailSendingFor: string | null
  sourceData: ControlData | null
}

const AppStateContext = createContext<AppStateValue | null>(null)
const fail = (error: unknown) => toast.error(error instanceof Error ? error.message : 'That did not go through')

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const demo = useDemoMode()
  const { data, loading, error, refresh, pendingTickets, syncing } = useControlCenter()
  const [period, setPeriodState] = useState<Period>('MTD')
  const [moneyLoading, setMoneyLoading] = useState(false)
  const [emailSendingFor, setEmailSendingFor] = useState<string | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [lastSyncAt, setLastSyncAt] = useState(Date.now())
  const [newSheetOpen, setNewSheetOpen] = useState(false)
  const [newLeadSheetOpen, setNewLeadSheetOpen] = useState(false)
  const [newJobSheetOpen, setNewJobSheetOpen] = useState(false)
  const [pinnedBarActive, setPinnedBarActive] = useState(false)
  const [showAllAttention, setShowAllAttention] = useState(false)
  const [lastAction, setLastAction] = useState<LastAction>(null)
  const [pendingVersion, setPendingVersion] = useState(0)
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, Quote>>({})
  const quoteDraftsRef = useRef<Record<string, Quote>>({})
  const noteTimers = useRef<Record<string, number>>({})
  const configuredData = useRef<ControlData | null>(null)

  // The approved pickers import stable catalog arrays directly. Hydrate those
  // arrays before any child screen renders real records so a direct deep link
  // can never flash or save the prototype catalog or placeholder drivers.
  if (data && configuredData.current !== data) {
    configurePricing({
      materials: mapMaterials(data),
      delivery: data.appSettings ? {
        tier3to5: Number(data.appSettings.delivery_tier_2_fee),
        tier6to10: Number(data.appSettings.delivery_tier_3_fee),
        over10Base: Number(data.appSettings.delivery_overage_base_fee),
        over10PerMile: Number(data.appSettings.delivery_overage_per_mile),
        over10Threshold: Number(data.appSettings.delivery_tier_3_max_miles),
      } : undefined,
    })
    configureDrivers(data.drivers.map((row) => ({ id: row.id, name: row.name, isActive: row.is_active })))
    configuredData.current = data
  }

  useEffect(() => {
    const timers = noteTimers.current
    const change = () => { setOnline(navigator.onLine); setPendingVersion((value) => value + 1) }
    window.addEventListener('online', change)
    window.addEventListener('offline', change)
    window.addEventListener('mt-queue-change', change)
    return () => {
      window.removeEventListener('online', change)
      window.removeEventListener('offline', change)
      window.removeEventListener('mt-queue-change', change)
      Object.values(timers).forEach(window.clearTimeout)
    }
  }, [])

  useEffect(() => { if (data) setLastSyncAt(Date.now()) }, [data])
  useEffect(() => { if (error) fail(error) }, [error])
  const baseCustomers = useMemo(() => data ? mapCustomers(data) : [], [data])
  const customers = useMemo(() => {
    if (!data) return baseCustomers
    const known = new Set(baseCustomers.map((entry) => entry.id))
    const legacy = data.tickets
      .filter((ticket) => !ticket.customer_id && !known.has(`legacy:${ticket.id}`))
      .map<Customer>((ticket) => ({
        id: `legacy:${ticket.id}`,
        name: ticket.customer_name || 'Legacy customer',
        phone: ticket.customer_phone || '',
        source: 'Legacy ticket',
        notes: '',
        createdAt: new Date(ticket.created_at).getTime(),
      }))
    return [...baseCustomers, ...legacy]
  }, [baseCustomers, data])
  const leads = useMemo(() => data ? mapLeads(data) : [], [data])
  const databaseQuotes = useMemo(() => data ? mapQuotes(data) : [], [data])
  const quotes = useMemo(
    () => databaseQuotes.map((quote) => quoteDrafts[quote.id] ?? quote),
    [databaseQuotes, quoteDrafts],
  )
  const jobs = useMemo(() => data ? mapJobs(data) : [], [data])
  const databaseTickets = useMemo(() => data ? mapTickets(data) : [], [data])
  const queuedTickets = useMemo<Ticket[]>(() => {
    void pendingVersion
    if (demo.enabled) return []
    if (!user?.id) return []
    return getQueue(user.id).map((entry) => ({
      id: entry.id,
      customerId: entry.context?.customerId ?? `legacy:${entry.id}`,
      jobId: entry.context?.jobId,
      driverId: entry.draft.driver_id ?? '',
      address: entry.draft.job_site_address,
      materialLines: entry.draft.items.map((item, index) => ({
        id: item.source_item_id ?? `${entry.id}:${index}`,
        materialId: item.material_id ?? '',
        materialName: item.material_name,
        isFullLoad: item.is_full_load,
        loads: item.loads,
        yards: Number(item.yards),
        rateUsed: Number(item.rate_used),
        lineTotal: Number(item.line_total),
      })),
      delivery: { mode: entry.draft.delivery_type === 'pickup' ? 'PICKUP' : entry.draft.delivery_type === 'custom' ? 'CUSTOM' : entry.draft.delivery_type === 'over_10' ? 'OVER_10' : entry.draft.delivery_type === 'tier_3' ? 'TIER_6_10' : entry.draft.delivery_type === 'tier_2' ? 'TIER_3_5' : 'TIER_0_2', miles: entry.draft.delivery_miles ?? undefined },
      deliveryLoads: entry.draft.load_count,
      taxRate: entry.draft.tax_rate,
      taxOnDelivery: entry.draft.tax_applies_to_delivery ?? false,
      notes: entry.draft.notes ?? '',
      status: 'SAVED',
      sync: 'PENDING',
      createdAt: new Date(entry.queued_at).getTime(),
      printCount: 0,
      edits: [],
      snapshotTotals: {
        materials: entry.draft.materials_subtotal,
        custom: 0,
        delivery: entry.draft.delivery_total,
        deliveryPerLoad: entry.draft.delivery_fee_per_load,
        taxable: entry.draft.tax_amount / (taxRateMultiplier(entry.draft.tax_rate) || 1),
        tax: entry.draft.tax_amount,
        total: entry.draft.grand_total,
        taxRate: entry.draft.tax_rate,
        taxOnDelivery: entry.draft.tax_applies_to_delivery ?? false,
        customWorkTax: 'PENDING',
        customTaxed: false,
      },
    }))
  }, [demo.enabled, pendingVersion, user?.id])
  const tickets = useMemo(() => [...queuedTickets, ...databaseTickets], [databaseTickets, queuedTickets])
  const invoices = useMemo(() => data ? mapInvoices(data) : [], [data])
  const payments = useMemo(() => data ? mapPayments(data) : [], [data])
  const workers = useMemo(() => data ? mapWorkers(data) : [], [data])
  const workerPayments = useMemo(() => data ? mapWorkerPayments(data) : [], [data])
  const activities = useMemo(() => data ? mapActivities(data) : [], [data])

  const setPeriod = useCallback((next: Period) => {
    setPeriodState(next)
    setMoneyLoading(true)
    window.setTimeout(() => setMoneyLoading(false), 180)
  }, [])
  const money = useMemo(() => computeMoney({ period, invoices, payments, workerPayments }), [period, invoices, payments, workerPayments])
  const pipeline = useMemo(() => {
    const open = quotes.filter((quote) => quote.status === 'DRAFT' || quote.status === 'SENT')
    return {
      newLeads: leads.filter((lead) => lead.status === 'NEW').length,
      openQuotes: open.length,
      openQuoteValue: open.reduce((sum, quote) => sum + quoteTotals(quote).total, 0),
      scheduledJobs: jobs.filter((job) => job.status === 'SCHEDULED').length,
    }
  }, [jobs, leads, quotes])
  const todayJobs = useMemo(() => jobs.filter((job) => job.date === dateKey(new Date()) && job.status !== 'CANCELLED'), [jobs])
  const derivedAttention = useMemo(() => deriveAttention({
    leads,
    quotes,
    jobs,
    invoices,
    customers,
    today: dateKey(new Date()),
    aiFailures: (data?.aiAuditLogs ?? [])
      .filter((entry) => entry.evaluation_type === 'AUTOMATION_DRY_RUN' && !entry.lead_id)
      .filter((entry, index, entries) => index === entries.findIndex((candidate) => candidate.automation_rule_id === entry.automation_rule_id && candidate.customer_id === entry.customer_id))
      .filter((entry) => entry.status === 'FAILED')
      .map((entry) => ({
        id: entry.id,
        customerId: entry.customer_id ?? undefined,
        automationRuleId: entry.automation_rule_id ?? undefined,
        at: new Date(entry.created_at).getTime(),
        error: entry.error_message ?? 'OpenAI could not produce a safe structured draft.',
      })),
    stripeFailures: (data?.stripeIssues ?? []).map((entry) => ({
      id: entry.provider_event_id,
      invoiceId: entry.invoice_id ?? undefined,
      at: new Date(entry.received_at).getTime(),
      error: entry.error_message ?? 'Stripe payment confirmation needs manual reconciliation.',
    })),
  }), [customers, data?.aiAuditLogs, data?.stripeIssues, invoices, jobs, leads, quotes])
  const snoozes = useMemo(() => new Map((data?.snoozes ?? []).map((row) => [row.fingerprint, new Date(row.returns_at).getTime()])), [data?.snoozes])
  const attention = useMemo(() => derivedAttention.filter((item) => (snoozes.get(item.id) ?? 0) <= Date.now()), [derivedAttention, snoozes])
  const snoozedItems = useMemo(() => derivedAttention.filter((item) => (snoozes.get(item.id) ?? 0) > Date.now()).map((item) => ({ item, returnsAt: snoozes.get(item.id) as number })), [derivedAttention, snoozes])
  const visibleAttention = showAllAttention ? attention : attention.slice(0, 5)

  const customerById = useCallback((id: string) => customers.find((entry) => entry.id === id), [customers])
  const leadById = useCallback((id: string) => leads.find((entry) => entry.id === id), [leads])
  const quoteById = useCallback((id: string) => quotes.find((entry) => entry.id === id), [quotes])
  const jobById = useCallback((id: string) => jobs.find((entry) => entry.id === id), [jobs])
  const ticketById = useCallback((id: string) => tickets.find((entry) => entry.id === id), [tickets])
  const invoiceById = useCallback((id: string) => invoices.find((entry) => entry.id === id), [invoices])
  const leadsForCustomer = useCallback((id: string) => leads.filter((entry) => entry.customerId === id).sort((a, b) => b.lastActivityAt - a.lastActivityAt), [leads])
  const quotesForCustomer = useCallback((id: string) => quotes.filter((entry) => entry.customerId === id).sort((a, b) => b.createdAt - a.createdAt), [quotes])
  const activitiesForCustomer = useCallback((id: string) => activities.filter((entry) => entry.customerId === id).sort((a, b) => b.at - a.at), [activities])
  const jobsForDay = useCallback((day: string) => jobs.filter((entry) => entry.date === day).sort((a, b) => Number(b.allDay) - Number(a.allDay) || (a.time ?? '').localeCompare(b.time ?? '')), [jobs])
  const jobsForCustomer = useCallback((id: string) => jobs.filter((entry) => entry.customerId === id).sort((a, b) => b.date.localeCompare(a.date)), [jobs])
  const photoJobsForCustomer = useCallback((id: string) => jobs.filter((entry) => entry.customerId === id && entry.photos.length > 0), [jobs])
  const unscheduledQuotes = useCallback(() => quotes.filter((quote) => quote.status === 'ACCEPTED' && !jobs.some((job) => job.quoteId === quote.id)), [jobs, quotes])
  const ticketsForJob = useCallback((id: string) => tickets.filter((entry) => entry.jobId === id), [tickets])
  const ticketsForCustomer = useCallback((id: string) => tickets.filter((entry) => entry.customerId === id), [tickets])
  const invoiceForJob = useCallback((id: string) => invoices.find((entry) => entry.jobId === id && entry.status !== 'VOID'), [invoices])
  const invoiceForTicket = useCallback((id: string) => invoices.find((entry) => entry.amountSource === 'TICKET' && entry.ticketIds.includes(id) && entry.status !== 'VOID'), [invoices])
  const paymentsForInvoice = useCallback((id: string) => payments.filter((entry) => entry.invoiceId === id), [payments])
  const workerPaymentsFor = useCallback((id: string) => workerPayments.filter((entry) => entry.workerId === id).sort((a, b) => b.createdAt - a.createdAt), [workerPayments])
  const findDuplicate = useCallback((phone: string, email?: string) => matchCustomer(customers.filter((entry) => !entry.id.startsWith('legacy:')), phone, email), [customers])

  const refreshAfter = useCallback(async <T,>(work: () => Promise<T>) => {
    const result = await work()
    await refresh()
    return result
  }, [refresh])
  const launch = useCallback((work: () => Promise<unknown>) => { void work().catch(fail) }, [])

  const createCustomer = useCallback(async (input: { name: string; phone: string; email?: string }) => {
    if (demo.enabled) {
      const duplicate = findDuplicate(input.phone, input.email)
      if (duplicate) return duplicate
      const now = new Date().toISOString()
      const id = `qa-runtime-customer-${(data?.customers.length ?? 0) + 1}`
      demo.updateData((current) => ({
        ...current,
        customers: [{
          id,
          name: input.name.trim(),
          phone: input.phone.trim() || null,
          normalized_phone: input.phone.replace(/\D/g, '') || null,
          email: input.email?.trim() || null,
          normalized_email: input.email?.trim().toLowerCase() || null,
          notes: '',
          sms_consent_at: null,
          sms_consent_source: null,
          sms_opted_out_at: null,
          is_active: true,
          last_activity_at: now,
          created_by: QA_FIXTURE_USER_ID,
          created_at: now,
          updated_at: now,
        }, ...current.customers],
      }))
      return { id, name: input.name.trim(), phone: input.phone.trim(), email: input.email?.trim() || undefined, source: 'Other', notes: '', createdAt: Date.now() }
    }
    const row = await refreshAfter(() => findOrCreateCustomer(input))
    return { id: row.id, name: row.name, phone: row.phone ?? '', email: row.email ?? undefined, source: 'Other', notes: row.notes ?? '', createdAt: new Date(row.created_at).getTime() }
  }, [data?.customers.length, demo, findDuplicate, refreshAfter])
  const createLead = useCallback(async (input: NewLeadInput) => {
    if (demo.enabled) {
      const duplicate = findDuplicate(input.phone, input.email)
      const customer = duplicate ?? await createCustomer({ name: input.name, phone: input.phone, email: input.email })
      const now = new Date().toISOString()
      const leadId = `qa-runtime-lead-${(data?.leads.length ?? 0) + 1}`
      demo.updateData((current) => ({
        ...current,
        leads: [{
          id: leadId,
          customer_id: customer.id,
          status: 'NEW',
          source: input.source as ControlData['leads'][number]['source'],
          campaign: input.campaign?.trim() || null,
          tracking_link_id: null,
          need: input.need.trim(),
          human_takeover: false,
          last_contact_at: null,
          lost_reason: null,
          notes: null,
          created_by: QA_FIXTURE_USER_ID,
          created_at: now,
          updated_at: now,
        }, ...current.leads],
        customers: current.customers.map((row) => row.id === customer.id ? { ...row, last_activity_at: now, updated_at: now } : row),
      }))
      return { leadId, customerId: customer.id, matchedExisting: Boolean(duplicate), customerName: customer.name }
    }
    const rows = await refreshAfter(() => createLeadRecord({ ...input, source: input.source as Parameters<typeof createLeadRecord>[0]['source'] }))
    const row = rows[0]
    if (!row) throw new Error('Lead creation returned no record')
    return { leadId: row.lead_id, customerId: row.customer_id, matchedExisting: row.matched_existing, customerName: input.name }
  }, [createCustomer, data?.leads.length, demo, findDuplicate, refreshAfter])
  const scheduleJob = useCallback(async (input: ScheduleJobInput) => {
    if (demo.enabled) {
      const now = new Date().toISOString()
      const id = `qa-runtime-job-${(data?.jobs.length ?? 0) + 1}`
      demo.updateData((current) => ({ ...current, jobs: [...current.jobs, {
        id, customer_id: input.customerId, quote_id: input.quoteId ?? null, category: input.category,
        status: 'SCHEDULED', scheduled_date: input.date, scheduled_time: input.allDay ? null : input.time ?? null,
        all_day: input.allDay, address: input.address, description: input.description, agreed_amount: input.agreedAmount,
        notes: input.notes ?? null, blocked_reason: null, blocked_at: null, change_requested: false,
        completed_at: null, cancelled_at: null, cancellation_reason: null, created_by: QA_FIXTURE_USER_ID,
        created_at: now, updated_at: now,
      }] }))
      return id
    }
    return refreshAfter(() => createJobRecord({ ...input, category: input.category as Parameters<typeof createJobRecord>[0]['category'] }))
  }, [data?.jobs.length, demo, refreshAfter])
  const rescheduleJob = useCallback((id: string, when: { date: string; time?: string; allDay: boolean }) => launch(async () => {
    if (demo.enabled) { const now = new Date().toISOString(); demo.updateData((current) => ({ ...current, jobs: current.jobs.map((row) => row.id === id ? { ...row, scheduled_date: when.date, scheduled_time: when.allDay ? null : when.time ?? null, all_day: when.allDay, change_requested: false, updated_at: now } : row) })); return }
    await updateJob(id, { scheduled_date: when.date, scheduled_time: when.allDay ? null : when.time ?? null, all_day: when.allDay, change_requested: false }); await refresh()
  }), [demo, launch, refresh])
  const completeJob = useCallback((id: string) => launch(async () => {
    if (demo.enabled) {
      const now = new Date().toISOString()
      demo.updateData((current) => {
        const job = current.jobs.find((row) => row.id === id)
        if (!job) return current
        const alreadyInvoiced = current.invoices.some((invoice) => invoice.job_id === id && invoice.status !== 'VOID')
        const quote = job.quote_id ? current.quotes.find((row) => row.id === job.quote_id) : undefined
        const invoiceId = `qa-runtime-invoice-${current.invoices.length + 1}`
        const billing = processingFeeFor(Number(quote?.grand_total ?? job.agreed_amount), current.controlSettings)
        return {
          ...current,
          jobs: current.jobs.map((row) => row.id === id ? { ...row, status: 'COMPLETED', completed_at: now, updated_at: now } : row),
          invoices: alreadyInvoiced ? current.invoices : [{
            id: invoiceId, invoice_number: String(1100 + current.invoices.length), customer_id: job.customer_id,
            job_id: id, quote_id: job.quote_id, standalone_ticket_id: null,
            amount_source: job.quote_id ? 'QUOTE' : 'JOB', description: job.description,
            subtotal_amount: billing.subtotal, processing_fee_rate: billing.rate,
            processing_fee_amount: billing.amount, amount: billing.total,
            status: 'DRAFT', issued_at: null, due_at: null,
            paid_at: null, disputed: false, dispute_note: null, payment_claimed_at: null,
            payment_claim_method: null, payment_claim_note: null, voided_at: null, void_reason: null,
            voided_by: null, created_by: QA_FIXTURE_USER_ID, created_at: now, updated_at: now,
          }, ...current.invoices],
        }
      })
      return
    }
    await completeJobAndPrepareInvoice(id)
    await refresh()
  }), [demo, launch, refresh])
  const cancelJob = useCallback((id: string, reason: string) => launch(async () => {
    if (demo.enabled) { const now = new Date().toISOString(); demo.updateData((current) => { const job = current.jobs.find((row) => row.id === id); return { ...current, jobs: current.jobs.map((row) => row.id === id ? { ...row, status: 'CANCELLED', cancelled_at: now, cancellation_reason: reason, updated_at: now } : row), activities: [{ id: `qa-runtime-activity-${current.activities.length + 1}`, customer_id: job?.customer_id ?? null, entity_type: 'JOB', entity_id: id, event_type: 'CANCELLED', summary: `Job cancelled: ${reason}`, metadata: { reason }, actor_id: QA_FIXTURE_USER_ID, actor_label: 'Salvador', created_at: now }, ...current.activities] } }); return }
    await updateJob(id, { status: 'CANCELLED', cancelled_at: new Date().toISOString(), cancellation_reason: reason }); await refresh()
  }), [demo, launch, refresh])
  const startJob = useCallback((id: string) => launch(async () => {
    if (demo.enabled) { const now = new Date().toISOString(); demo.updateData((current) => ({ ...current, jobs: current.jobs.map((row) => row.id === id ? { ...row, status: 'IN_PROGRESS', blocked_reason: null, blocked_at: null, updated_at: now } : row) })); return }
    await updateJob(id, { status: 'IN_PROGRESS' }); await refresh()
  }), [demo, launch, refresh])
  const debounce = useCallback((key: string, work: () => Promise<unknown>) => { window.clearTimeout(noteTimers.current[key]); noteTimers.current[key] = window.setTimeout(() => launch(work), 500) }, [launch])
  const updateJobNotes = useCallback((id: string, notes: string) => debounce(`job:${id}`, async () => { if (demo.enabled) { demo.updateData((current) => ({ ...current, jobs: current.jobs.map((row) => row.id === id ? { ...row, notes, updated_at: new Date().toISOString() } : row) })); return } await updateJob(id, { notes }); await refresh() }), [debounce, demo, refresh])
  const updateLeadNotes = useCallback((id: string, notes: string) => debounce(`lead:${id}`, async () => { if (demo.enabled) { demo.updateData((current) => ({ ...current, leads: current.leads.map((row) => row.id === id ? { ...row, notes, updated_at: new Date().toISOString() } : row) })); return } await updateLead(id, { notes }); await refresh() }), [debounce, demo, refresh])
  const updateCustomerNotes = useCallback((id: string, notes: string) => debounce(`customer:${id}`, async () => { if (demo.enabled) { demo.updateData((current) => ({ ...current, customers: current.customers.map((row) => row.id === id ? { ...row, notes, updated_at: new Date().toISOString() } : row) })); return } const { error: saveError } = await controlDb.from('customers').update({ notes }).eq('id', id); if (saveError) throw new Error(saveError.message); await refresh() }), [debounce, demo, refresh])
  const replyToLead = useCallback((id: string, text: string) => {
    const lead = leadById(id)
    if (!lead) return
    if (demo.enabled) {
      const now = new Date().toISOString()
      demo.updateData((current) => ({
        ...current,
        messages: [...current.messages, { id: `qa-runtime-message-${current.messages.length + 1}`, lead_id: id, customer_id: lead.customerId, sender_type: 'HUMAN', body: text, delivery_status: 'INTERNAL', provider_message_id: null, created_by: QA_FIXTURE_USER_ID, created_at: now }],
        leads: current.leads.map((row) => row.id === id ? { ...row, human_takeover: true, last_contact_at: now, updated_at: now } : row),
      }))
      return
    }
    if (data?.controlSettings?.sms_status !== 'READY') { toast.error('SMS setup is required before a reply can be sent.'); return }
    launch(async () => { await addLeadMessage({ leadId: id, customerId: lead.customerId, body: text, deliveryStatus: 'PENDING' }); await refresh() })
  }, [data?.controlSettings?.sms_status, demo, launch, leadById, refresh])

  const quoteDraft = useCallback((quote: Quote): QuoteDraft => {
    const totals = computeTotals({ materialLines: quote.materialLines, customLines: quote.customLines, delivery: quote.delivery, deliveryLoads: quote.deliveryLoads, taxRate: quote.taxRate, taxOnDelivery: quote.taxOnDelivery, customWorkTax: quote.customWorkTax })
    return {
      customerId: quote.customerId,
      leadId: quote.leadId,
      description: quote.description,
      address: quote.address,
      deliveryType: deliveryToDatabase(quote.delivery),
      deliveryMiles: quote.delivery.miles,
      deliveryFeePerLoad: totals.deliveryPerLoad,
      deliveryLoadCount: quote.deliveryLoads,
      deliveryTotal: totals.delivery,
      materialsSubtotal: totals.materials,
      customWorkSubtotal: totals.custom,
      taxRate: quote.taxRate,
      taxOnDelivery: quote.taxOnDelivery,
      customWorkTaxRule: quote.customWorkTax === 'NOT_TAXED' ? 'EXEMPT' : quote.customWorkTax,
      taxAmount: totals.tax,
      grandTotal: totals.total,
      items: [
        ...quote.materialLines.map((line) => ({ kind: 'MATERIAL' as const, materialId: line.materialId || undefined, description: line.materialName, loads: line.loads ?? undefined, yards: line.yards, isFullLoad: line.isFullLoad, rateUsed: line.rateUsed, lineTotal: line.lineTotal })),
        ...quote.customLines.map((line) => ({ kind: 'CUSTOM_WORK' as const, description: line.label, isFullLoad: false, rateUsed: line.amount, lineTotal: line.amount })),
      ],
    }
  }, [])
  const createQuoteFromLead = useCallback(async (id: string) => {
    if (demo.enabled) {
      const lead = data?.leads.find((row) => row.id === id)
      if (!lead) throw new Error('Lead not found')
      const now = new Date().toISOString()
      const quoteId = `qa-runtime-quote-${(data?.quotes.length ?? 0) + 1}`
      const quoteNumber = `Q${1110 + (data?.quotes.length ?? 0)}`
      demo.updateData((current) => ({
        ...current,
        quotes: [{ id: quoteId, quote_number: quoteNumber, customer_id: lead.customer_id, lead_id: id, status: 'DRAFT', description: lead.need, address: '', delivery_type: null, delivery_miles: null, delivery_fee_per_load: 0, delivery_load_count: 0, delivery_total: 0, materials_subtotal: 0, custom_work_subtotal: 0, tax_rate: effectiveTaxRate(current.appSettings), tax_applies_to_delivery: false, custom_work_tax_rule: 'EXEMPT', tax_amount: 0, grand_total: 0, notes: null, sent_at: null, accepted_at: null, declined_at: null, voided_at: null, void_reason: null, created_by: QA_FIXTURE_USER_ID, created_at: now, updated_at: now }, ...current.quotes],
        leads: current.leads.map((row) => row.id === id ? { ...row, status: 'QUOTED', updated_at: now } : row),
      }))
      return quoteId
    }
    const rows = await refreshAfter(() => createQuoteDraft(id)); return rows[0]?.id ?? ''
  }, [data?.leads, data?.quotes.length, demo, refreshAfter])
  const clearQuoteDraft = useCallback((id: string, expected?: Quote) => {
    const current = quoteDraftsRef.current
    if (expected && current[id] !== expected) return
    const next = { ...current }
    delete next[id]
    quoteDraftsRef.current = next
    setQuoteDrafts(next)
  }, [])
  const saveQuoteDraftNow = useCallback(async (quote: Quote) => {
    if (demo.enabled) {
      const draft = quoteDraft({ ...quote, snapshotTotals: undefined })
      const now = new Date().toISOString()
      demo.updateData((current) => ({
        ...current,
        quotes: current.quotes.map((row) => row.id === quote.id ? {
          ...row,
          customer_id: draft.customerId,
          lead_id: draft.leadId ?? null,
          description: draft.description,
          address: draft.address,
          delivery_type: draft.deliveryType,
          delivery_miles: draft.deliveryMiles ?? null,
          delivery_fee_per_load: draft.deliveryFeePerLoad,
          delivery_load_count: draft.deliveryLoadCount,
          delivery_total: draft.deliveryTotal,
          materials_subtotal: draft.materialsSubtotal,
          custom_work_subtotal: draft.customWorkSubtotal,
          tax_rate: draft.taxRate,
          tax_applies_to_delivery: false,
          custom_work_tax_rule: 'EXEMPT',
          tax_amount: draft.taxAmount,
          grand_total: draft.grandTotal,
          updated_at: now,
        } : row),
        quoteItems: [
          ...current.quoteItems.filter((row) => row.quote_id !== quote.id),
          ...draft.items.map((item, index) => ({ id: `qa-runtime-quote-item-${quote.id}-${index + 1}`, quote_id: quote.id, kind: item.kind, material_id: item.materialId ?? null, description: item.description, loads: item.loads ?? null, yards: item.yards ?? null, is_full_load: item.isFullLoad, rate_used: item.rateUsed, line_total: item.lineTotal, created_at: now })),
        ],
      }))
      clearQuoteDraft(quote.id, quote)
      return
    }
    await saveQuoteChanges(quote.id, quoteDraft({ ...quote, snapshotTotals: undefined }))
    await refresh()
    clearQuoteDraft(quote.id, quote)
  }, [clearQuoteDraft, demo, quoteDraft, refresh])
  const patchQuote = useCallback((id: string, patch: (quote: Quote) => Quote) => {
    const current = quoteDraftsRef.current[id] ?? quoteById(id)
    if (!current || current.status !== 'DRAFT') return
    const nextQuote = patch(current)
    const nextDrafts = { ...quoteDraftsRef.current, [id]: nextQuote }
    quoteDraftsRef.current = nextDrafts
    setQuoteDrafts(nextDrafts)
    const key = `quote:${id}`
    window.clearTimeout(noteTimers.current[key])
    noteTimers.current[key] = window.setTimeout(() => {
      void saveQuoteDraftNow(nextQuote).catch(fail)
    }, 450)
  }, [quoteById, saveQuoteDraftNow])
  const updateQuoteMeta = useCallback((id: string, patch: { description?: string; address?: string }) => patchQuote(id, (quote) => ({ ...quote, ...patch })), [patchQuote])
  const addMaterialLine = useCallback((id: string, materialId: string, options: { isFullLoad: boolean; loads?: number; yards?: number }) => { if (!data) return; const material = mapMaterials(data).find((entry) => entry.id === materialId); if (!material) return; const loads = Math.max(1, Math.round(options.loads ?? 1)); const isFull = options.isFullLoad; const line: MaterialLine = { id: crypto.randomUUID(), materialId, materialName: material.name, isFullLoad: isFull, loads: isFull ? loads : 0, yards: isFull ? material.fullLoadYards * loads : Number(options.yards ?? 0), rateUsed: isFull ? material.fullLoadPrice : material.pricePerYard, lineTotal: isFull ? material.fullLoadPrice * loads : material.pricePerYard * Number(options.yards ?? 0) }; patchQuote(id, (quote) => { const lines = [...quote.materialLines, line]; return { ...quote, materialLines: lines, deliveryLoads: suggestedDeliveryLoads(lines) } }) }, [data, patchQuote])
  const removeMaterialLine = useCallback((id: string, lineId: string) => patchQuote(id, (quote) => ({ ...quote, materialLines: quote.materialLines.filter((line) => line.id !== lineId) })), [patchQuote])
  const addCustomLine = useCallback((id: string, label: string, amount: number) => patchQuote(id, (quote) => ({ ...quote, customLines: [...quote.customLines, { id: crypto.randomUUID(), label, amount }] })), [patchQuote])
  const removeCustomLine = useCallback((id: string, lineId: string) => patchQuote(id, (quote) => ({ ...quote, customLines: quote.customLines.filter((line) => line.id !== lineId) })), [patchQuote])
  const setQuoteDelivery = useCallback((id: string, delivery: DeliverySelection) => patchQuote(id, (quote) => ({ ...quote, delivery })), [patchQuote])
  const setQuoteDeliveryLoads = useCallback((id: string, deliveryLoads: number) => patchQuote(id, (quote) => ({ ...quote, deliveryLoads })), [patchQuote])
  const sendQuote = useCallback((id: string) => launch(async () => {
    if (emailSendingFor === id) return
    const current = quoteDraftsRef.current[id] ?? quoteById(id)
    if (demo.enabled) {
      if (current?.status === 'DRAFT') {
        window.clearTimeout(noteTimers.current[`quote:${id}`])
        await saveQuoteDraftNow(current)
      }
      const now = new Date().toISOString()
      demo.updateData((fixture) => ({ ...fixture, quotes: fixture.quotes.map((row) => row.id === id ? { ...row, status: 'SENT', sent_at: now, updated_at: now } : row) }))
      clearQuoteDraft(id)
      toast.info('Quote email simulated in demo mode. No email was sent.')
      return
    }
    setEmailSendingFor(id)
    try {
      if (current?.status === 'DRAFT') {
        window.clearTimeout(noteTimers.current[`quote:${id}`])
        await saveQuoteChanges(id, quoteDraft({ ...current, snapshotTotals: undefined }))
      }
      await sendCustomerEmail({
        template: 'QUOTE_READY',
        recordId: id,
        resend: current?.status !== 'DRAFT',
        requestId: crypto.randomUUID(),
      })
      clearQuoteDraft(id)
      await refresh()
      toast.success(current?.status === 'DRAFT' ? 'Quote emailed.' : 'Quote emailed again.')
    } finally {
      setEmailSendingFor(null)
    }
  }), [clearQuoteDraft, demo, emailSendingFor, launch, quoteById, quoteDraft, refresh, saveQuoteDraftNow])
  const acceptQuote = useCallback((id: string) => launch(async () => { if (demo.enabled) { const now = new Date().toISOString(); demo.updateData((current) => ({ ...current, quotes: current.quotes.map((row) => row.id === id ? { ...row, status: 'ACCEPTED', accepted_at: now, updated_at: now } : row) })); return } await updateQuote(id, { status: 'ACCEPTED', accepted_at: new Date().toISOString() }); await refresh() }), [demo, launch, refresh])
  const declineQuote = useCallback((id: string) => launch(async () => { if (demo.enabled) { const now = new Date().toISOString(); demo.updateData((current) => ({ ...current, quotes: current.quotes.map((row) => row.id === id ? { ...row, status: 'DECLINED', declined_at: now, updated_at: now } : row) })); return } await updateQuote(id, { status: 'DECLINED', declined_at: new Date().toISOString() }); await refresh() }), [demo, launch, refresh])

  const toTicketDraft = useCallback((input: SaveTicketInput): TicketDraft => {
    const customer = customerById(input.customerId)
    const fee = deliveryFeePerLoad(input.delivery)
    const taxRate = effectiveTaxRate(data?.appSettings)
    const taxOnDelivery = false
    const totals = computeTotals({ materialLines: input.materialLines, customLines: [], delivery: input.delivery, deliveryLoads: input.deliveryLoads, taxRate, taxOnDelivery })
    return {
      customer_name: customer?.name ?? '', customer_phone: customer?.phone ?? '', job_site_address: input.address,
      driver_id: input.driverId || null, delivery_type: deliveryToDatabase(input.delivery), delivery_miles: input.delivery.miles ?? null,
      delivery_fee_per_load: fee, load_count: input.deliveryLoads, delivery_total: totals.delivery,
      materials_subtotal: totals.materials, tax_rate: taxRate, tax_applies_to_delivery: taxOnDelivery,
      tax_amount: totals.tax, grand_total: totals.total, notes: input.notes || null,
      items: input.materialLines.map((line) => ({ source_item_id: line.id, material_id: line.materialId || null, material_name: line.materialName, yards: line.yards, is_full_load: line.isFullLoad, rate_used: line.rateUsed, line_total: line.lineTotal, loads: line.loads })),
    }
  }, [customerById, data?.appSettings])
  const saveTicket = useCallback(async (input: SaveTicketInput) => {
    if (demo.enabled) {
      const draft = toTicketDraft(input)
      const now = new Date().toISOString()
      const id = `qa-runtime-ticket-${(data?.tickets.length ?? 0) + 1}`
      demo.updateData((current) => ({
        ...current,
        tickets: [{ id, ticket_number: '', client_request_id: `qa-runtime-request-${current.tickets.length + 1}`, customer_id: input.customerId, job_id: input.jobId ?? null, customer_name: draft.customer_name, customer_phone: draft.customer_phone, job_site_address: draft.job_site_address, driver_id: draft.driver_id, delivery_type: draft.delivery_type, delivery_miles: draft.delivery_miles, delivery_fee_per_load: draft.delivery_fee_per_load, load_count: draft.load_count, delivery_total: draft.delivery_total, materials_subtotal: draft.materials_subtotal, tax_rate: draft.tax_rate, tax_applies_to_delivery: draft.tax_applies_to_delivery, tax_amount: draft.tax_amount, grand_total: draft.grand_total, notes: draft.notes, payment_status: 'unpaid', status: 'pending', printed_at: null, voided_at: null, void_reason: null, voided_by: null, created_by: QA_FIXTURE_USER_ID, created_at: now, updated_at: now }, ...current.tickets],
        ticketItems: [...current.ticketItems, ...draft.items.map((item, index) => ({ id: `qa-runtime-ticket-item-${current.ticketItems.length + index + 1}`, ticket_id: id, material_id: item.material_id, material_name: item.material_name, yards: item.yards, is_full_load: item.is_full_load, loads: item.loads ?? null, rate_used: item.rate_used, line_total: item.line_total, superseded_at: null, created_at: now }))],
      }))
      return id
    }
    if (!user?.id) throw new Error('Sign in is required')
    const result = await saveTicketRecord(toTicketDraft(input), user.id, { customerId: input.customerId, jobId: input.jobId })
    setPendingVersion((value) => value + 1)
    if (!result.queued) await refresh()
    return result.queued ? result.requestId : result.ticket.id
  }, [data?.tickets.length, demo, refresh, toTicketDraft, user?.id])
  const updateTicket = useCallback(async (id: string, input: SaveTicketInput, note: string) => {
    if (demo.enabled) {
      const draft = toTicketDraft(input)
      const now = new Date().toISOString()
      demo.updateData((current) => {
        const before = current.tickets.find((row) => row.id === id) ?? null
        return {
          ...current,
          tickets: current.tickets.map((row) => row.id === id ? { ...row, customer_id: input.customerId, job_id: input.jobId ?? null, customer_name: draft.customer_name, customer_phone: draft.customer_phone, job_site_address: draft.job_site_address, driver_id: draft.driver_id, delivery_type: draft.delivery_type, delivery_miles: draft.delivery_miles, delivery_fee_per_load: draft.delivery_fee_per_load, load_count: draft.load_count, delivery_total: draft.delivery_total, materials_subtotal: draft.materials_subtotal, tax_rate: draft.tax_rate, tax_applies_to_delivery: draft.tax_applies_to_delivery, tax_amount: draft.tax_amount, grand_total: draft.grand_total, notes: draft.notes, updated_at: now } : row),
          // ControlData mirrors the live loader, which returns only current item
          // snapshots. The before snapshot remains in ticketHistory just as it
          // would after the atomic correction RPC.
          ticketItems: [...current.ticketItems.filter((row) => row.ticket_id !== id), ...draft.items.map((item, index) => ({ id: `qa-runtime-ticket-correction-item-${current.ticketItems.length + index + 1}`, ticket_id: id, material_id: item.material_id, material_name: item.material_name, yards: item.yards, is_full_load: item.is_full_load, loads: item.loads ?? null, rate_used: item.rate_used, line_total: item.line_total, superseded_at: null, created_at: now }))],
          ticketHistory: [{ id: `qa-runtime-ticket-history-${current.ticketHistory.length + 1}`, ticket_id: id, event_type: 'corrected', reason: note, before_snapshot: before, after_snapshot: draft as unknown as Json, actor_id: QA_FIXTURE_USER_ID, actor_label: 'Salvador', created_at: now }, ...current.ticketHistory],
        }
      })
      return
    }
    await correctTicket(id, note, toTicketDraft(input)); await refresh()
  }, [demo, refresh, toTicketDraft])
  const voidTicket = useCallback((id: string, reason: string) => launch(async () => {
    if (demo.enabled) { const now = new Date().toISOString(); demo.updateData((current) => { const before = current.tickets.find((row) => row.id === id) ?? null; return { ...current, tickets: current.tickets.map((row) => row.id === id ? { ...row, status: 'void', voided_at: now, void_reason: reason, voided_by: QA_FIXTURE_USER_ID, updated_at: now } : row), ticketHistory: [{ id: `qa-runtime-ticket-history-${current.ticketHistory.length + 1}`, ticket_id: id, event_type: 'voided', reason, before_snapshot: before, after_snapshot: null, actor_id: QA_FIXTURE_USER_ID, actor_label: 'Salvador', created_at: now }, ...current.ticketHistory] } }); return }
    await voidTicketRecord(id, reason); await refresh()
  }), [demo, launch, refresh])
  const deleteTicket = useCallback(async (id: string, confirmation: string, reason: string): Promise<TicketDeleteResult> => {
    if (demo.enabled) {
      if (!data) return { status: 'NOT_FOUND' }
      const ticket = data.tickets.find((row) => row.id === id)
      if (!ticket) return { status: 'NOT_FOUND' }
      if (confirmation.trim() !== ticket.ticket_number) {
        return { status: 'CONFIRMATION_MISMATCH', ticket_number: ticket.ticket_number }
      }
      const protectedResult = ticketDeleteProtection(data, id)
      if (protectedResult) return protectedResult
      demo.updateData((current) => ({
        ...current,
        tickets: current.tickets.filter((row) => row.id !== id),
        ticketItems: current.ticketItems.filter((row) => row.ticket_id !== id),
        ticketHistory: current.ticketHistory.filter((row) => row.ticket_id !== id),
        activities: current.activities.filter((row) => !(row.entity_type === 'TICKET' && row.entity_id === id)),
      }))
      return { status: 'DELETED', ticket_number: ticket.ticket_number }
    }
    const result = await deleteTicketPermanently(id, confirmation, reason)
    if (result.status === 'DELETED') await refresh()
    return result
  }, [data, demo, refresh])
  const printTicket = useCallback((id: string) => {
    const ticket = ticketById(id); if (!ticket || !ticket.number) return
    const customer = customerById(ticket.customerId); const totals = ticketTotals(ticket)
    launch(async () => {
      const blob = await renderTicketPng({
        companyName: data?.appSettings?.company_name ?? 'Monkey Trucking LLC', companyTagline: 'Material and delivery ticket',
        companyAddress: data?.appSettings?.company_address ?? '', companyCityStateZip: data?.appSettings?.company_city_state_zip ?? '', companyPhone: data?.appSettings?.company_phone ?? '',
        ticketNumber: ticket.number as string, createdAt: new Date(ticket.createdAt), customerName: customer?.name ?? '', customerPhone: customer?.phone ?? '', jobSiteAddress: ticket.address,
        items: ticket.materialLines.map((line) => ({ name: line.materialName, detail: line.isFullLoad && line.loads !== null ? `${line.loads} load${line.loads === 1 ? '' : 's'} / ${line.yards} yd` : `${line.yards} yd`, amount: `$${line.lineTotal.toFixed(2)}` })),
        subtotal: `$${totals.materials.toFixed(2)}`, deliveryLabel: 'Delivery', deliveryAmount: `$${totals.delivery.toFixed(2)}`, taxLabel: `Tax ${formatTaxRate(totals.taxRate)}`, taxAmount: `$${totals.tax.toFixed(2)}`, total: `$${totals.total.toFixed(2)}`,
        driver: data?.drivers.find((driver) => driver.id === ticket.driverId)?.name ?? '', notes: ticket.notes, copies: data?.appSettings?.print_copies ?? 1,
      })
      await outputTicketPng(blob, data?.appSettings?.print_method === 'direct' ? 'direct' : 'share', `${ticket.number}.png`, `Ticket ${ticket.number}`)
      if (demo.enabled) {
        const now = new Date().toISOString()
        demo.updateData((current) => ({ ...current, tickets: current.tickets.map((row) => row.id === id ? { ...row, printed_at: now, updated_at: now } : row) }))
        return
      }
      await supabase.from('tickets').update({ printed_at: new Date().toISOString() }).eq('id', id)
      await refresh()
    })
  }, [customerById, data, demo, launch, refresh, ticketById])

  const createInvoiceFromJob = useCallback(async (id: string) => {
    if (demo.enabled) {
      const job = data?.jobs.find((row) => row.id === id)
      if (!job) throw new Error('Job not found')
      const quote = job.quote_id ? data?.quotes.find((row) => row.id === job.quote_id) : undefined
      const now = new Date().toISOString()
      const invoiceId = `qa-runtime-invoice-${(data?.invoices.length ?? 0) + 1}`
      demo.updateData((current) => {
        const billing = processingFeeFor(Number(quote?.grand_total ?? job.agreed_amount), current.controlSettings)
        return { ...current, invoices: [{ id: invoiceId, invoice_number: String(1100 + current.invoices.length), customer_id: job.customer_id, job_id: id, quote_id: job.quote_id, standalone_ticket_id: null, amount_source: job.quote_id ? 'QUOTE' : 'JOB', description: job.description, subtotal_amount: billing.subtotal, processing_fee_rate: billing.rate, processing_fee_amount: billing.amount, amount: billing.total, status: 'DRAFT', issued_at: null, due_at: null, paid_at: null, disputed: false, dispute_note: null, payment_claimed_at: null, payment_claim_method: null, payment_claim_note: null, voided_at: null, void_reason: null, voided_by: null, created_by: QA_FIXTURE_USER_ID, created_at: now, updated_at: now }, ...current.invoices] }
      })
      return invoiceId
    }
    return refreshAfter(() => createInvoiceFromJobRecord(id))
  }, [data?.invoices.length, data?.jobs, data?.quotes, demo, refreshAfter])
  const createInvoiceFromTicket = useCallback(async (id: string) => {
    if (demo.enabled) {
      const ticket = data?.tickets.find((row) => row.id === id)
      if (!ticket || ticket.status === 'void' || ticket.job_id) throw new Error('Only a finalized standalone ticket can create an invoice')
      const now = new Date().toISOString()
      const invoiceId = `qa-runtime-invoice-${(data?.invoices.length ?? 0) + 1}`
      demo.updateData((current) => {
        const billing = processingFeeFor(Number(ticket.grand_total), current.controlSettings)
        return { ...current, invoices: [{ id: invoiceId, invoice_number: String(1100 + current.invoices.length), customer_id: ticket.customer_id ?? '', job_id: null, quote_id: null, standalone_ticket_id: id, amount_source: 'TICKET', description: `Direct material order ${ticket.ticket_number}`, subtotal_amount: billing.subtotal, processing_fee_rate: billing.rate, processing_fee_amount: billing.amount, amount: billing.total, status: 'DRAFT', issued_at: null, due_at: null, paid_at: null, disputed: false, dispute_note: null, payment_claimed_at: null, payment_claim_method: null, payment_claim_note: null, voided_at: null, void_reason: null, voided_by: null, created_by: QA_FIXTURE_USER_ID, created_at: now, updated_at: now }, ...current.invoices], invoiceTickets: [...current.invoiceTickets, { invoice_id: invoiceId, ticket_id: id, created_at: now }] }
      })
      return invoiceId
    }
    return refreshAfter(() => createInvoiceFromTicketRecord(id))
  }, [data?.invoices.length, data?.tickets, demo, refreshAfter])
  const reviseInvoice = useCallback(async (id: string, input: { amount: number; description: string; reason: string }) => {
    if (demo.enabled) {
      const now = new Date().toISOString()
      demo.updateData((current) => ({
        ...current,
        invoices: current.invoices.map((row) => {
          if (row.id !== id || row.status !== 'DRAFT') return row
          const billing = processingFeeFor(input.amount, {
            processing_fee_enabled: Number(row.processing_fee_rate) > 0,
            processing_fee_rate: row.processing_fee_rate,
          })
          return { ...row, subtotal_amount: billing.subtotal, processing_fee_amount: billing.amount, amount: billing.total, description: input.description, updated_at: now }
        }),
        financialHistory: [{
          id: `qa-runtime-financial-${current.financialHistory.length + 1}`,
          record_type: 'INVOICE', record_id: id, event_type: 'DRAFT_REVISED', reason: input.reason,
          before_snapshot: null, after_snapshot: { amount: input.amount, description: input.description },
          actor_id: QA_FIXTURE_USER_ID, actor_label: 'Salvador', created_at: now,
        }, ...current.financialHistory],
      }))
      return
    }
    await reviseDraftInvoice(id, input.amount, input.description, input.reason)
    await refresh()
  }, [demo, refresh])
  const sendInvoice = useCallback((id: string) => launch(async () => {
    if (emailSendingFor === id) return
    const due = new Date(); due.setDate(due.getDate() + (data?.controlSettings?.default_invoice_due_days ?? 3))
    if (demo.enabled) { const now = new Date().toISOString(); demo.updateData((current) => ({ ...current, invoices: current.invoices.map((row) => row.id === id ? { ...row, status: 'SENT', issued_at: now, due_at: due.toISOString(), updated_at: now } : row) })); toast.info('Invoice email simulated in demo mode. No email was sent.'); return }
    setEmailSendingFor(id)
    try {
      await sendCustomerEmail({ template: 'INVOICE_READY', recordId: id, requestId: crypto.randomUUID() })
      await refresh()
      toast.success('Invoice emailed.')
    } finally {
      setEmailSendingFor(null)
    }
  }), [data?.controlSettings?.default_invoice_due_days, demo, emailSendingFor, launch, refresh])
  const resendInvoice = useCallback((id: string) => launch(async () => {
    if (emailSendingFor === id) return
    if (demo.enabled) { toast.info('Invoice resend simulated in demo mode. No email was sent.'); return }
    setEmailSendingFor(id)
    try {
      await sendCustomerEmail({ template: 'INVOICE_READY', recordId: id, resend: true, requestId: crypto.randomUUID() })
      await refresh()
      toast.success('Invoice emailed again.')
    } finally {
      setEmailSendingFor(null)
    }
  }), [demo, emailSendingFor, launch, refresh])
  const voidInvoice = useCallback((id: string, reason: string) => launch(async () => { if (demo.enabled) { const now = new Date().toISOString(); demo.updateData((current) => ({ ...current, invoices: current.invoices.map((row) => row.id === id ? { ...row, status: 'VOID', voided_at: now, void_reason: reason, voided_by: QA_FIXTURE_USER_ID, updated_at: now } : row), financialHistory: [{ id: `qa-runtime-financial-${current.financialHistory.length + 1}`, record_type: 'INVOICE', record_id: id, event_type: 'VOIDED', reason, before_snapshot: null, after_snapshot: null, actor_id: QA_FIXTURE_USER_ID, actor_label: 'Salvador', created_at: now }, ...current.financialHistory] })); return } await voidFinancialRecord('INVOICE', id, reason); await refresh() }), [demo, launch, refresh])
  const recordPayment = useCallback((input: { invoiceId: string; amount: number; method: PaymentMethod; receivedAt: number; note: string }) => launch(async () => {
    if (demo.enabled) { const now = new Date(input.receivedAt).toISOString(); demo.updateData((current) => { const invoice = current.invoices.find((row) => row.id === input.invoiceId); if (!invoice) return current; const paymentId = `qa-runtime-payment-${current.payments.length + 1}`; return { ...current, payments: [{ id: paymentId, invoice_id: input.invoiceId, customer_id: invoice.customer_id, amount: input.amount, method: input.method, confirmed_by: 'HUMAN', note: input.note || null, received_at: now, recorded_by: QA_FIXTURE_USER_ID, recorded_at: now, voided_at: null, void_reason: null, voided_by: null }, ...current.payments], invoices: current.invoices.map((row) => row.id === input.invoiceId ? { ...row, status: 'PAID', paid_at: now, payment_claimed_at: null, updated_at: now } : row), financialHistory: [{ id: `qa-runtime-financial-${current.financialHistory.length + 1}`, record_type: 'PAYMENT', record_id: paymentId, event_type: 'RECORDED', reason: 'Full outstanding balance recorded in demo', before_snapshot: null, after_snapshot: { amount: input.amount }, actor_id: QA_FIXTURE_USER_ID, actor_label: 'Salvador', created_at: now }, ...current.financialHistory] } }); return }
    const paymentId = await recordPaymentRecord(input.invoiceId, input.method, input.note, new Date(input.receivedAt).toISOString())
    await refresh()
    try {
      const result = await sendCustomerEmail({ template: 'PAYMENT_RECEIVED', recordId: paymentId })
      if (result.skipped && result.reason === 'missing_email') {
        toast.info('Payment recorded. No receipt email was sent because the customer has no email address.')
      } else {
        toast.success('Payment recorded and receipt emailed.')
      }
    } catch (error) {
      toast.error(`Payment recorded. Receipt email failed: ${error instanceof Error ? error.message : 'retry later'}`)
    }
  }), [demo, launch, refresh])
  const addHourlyWorkerPay = useCallback((input: { workerId: string; periodStart: string; periodEnd: string; hours: number; rate: number }) => launch(async () => {
    if (demo.enabled) { const now = new Date().toISOString(); demo.updateData((current) => ({ ...current, workerPayments: [{ id: `qa-runtime-worker-pay-${current.workerPayments.length + 1}`, worker_id: input.workerId, period_start: input.periodStart, period_end: input.periodEnd, hours: input.hours, rate: input.rate, amount: input.hours * input.rate, status: 'PENDING', source: 'MANUAL', attachment_path: null, confirmed_at: null, paid_at: null, voided_at: null, void_reason: null, voided_by: null, created_by: QA_FIXTURE_USER_ID, created_at: now, updated_at: now }, ...current.workerPayments] })); return }
    await createWorkerPayment({ ...input, amount: input.hours * input.rate, source: 'MANUAL' }); await refresh()
  }), [demo, launch, refresh])
  const addDriverWorkerPay = useCallback((input: { workerId: string; periodStart: string; periodEnd: string; amount: number; attachmentName: string }) => launch(async () => {
    if (demo.enabled) { const now = new Date().toISOString(); demo.updateData((current) => ({ ...current, workerPayments: [{ id: `qa-runtime-worker-pay-${current.workerPayments.length + 1}`, worker_id: input.workerId, period_start: input.periodStart, period_end: input.periodEnd, hours: null, rate: null, amount: input.amount, status: 'PENDING', source: 'DRIVER_INVOICE', attachment_path: input.attachmentName, confirmed_at: null, paid_at: null, voided_at: null, void_reason: null, voided_by: null, created_by: QA_FIXTURE_USER_ID, created_at: now, updated_at: now }, ...current.workerPayments] })); return }
    await createWorkerPayment({ workerId: input.workerId, periodStart: input.periodStart, periodEnd: input.periodEnd, amount: input.amount, source: 'DRIVER_INVOICE', attachmentPath: input.attachmentName }); await refresh()
  }), [demo, launch, refresh])
  const confirmWorkerPayDetails = useCallback((id: string) => launch(async () => { if (demo.enabled) { const now = new Date().toISOString(); demo.updateData((current) => ({ ...current, workerPayments: current.workerPayments.map((row) => row.id === id ? { ...row, status: 'CONFIRMED', confirmed_at: now, updated_at: now } : row) })); return } await confirmWorkerPayment(id); await refresh() }), [demo, launch, refresh])
  const markWorkerPayPaid = useCallback((id: string) => launch(async () => { if (demo.enabled) { const now = new Date().toISOString(); demo.updateData((current) => { const payment = current.workerPayments.find((row) => row.id === id); return { ...current, workerPayments: current.workerPayments.map((row) => row.id === id ? { ...row, status: 'PAID', paid_at: now, updated_at: now } : row), financialHistory: [{ id: `qa-runtime-financial-${current.financialHistory.length + 1}`, record_type: 'WORKER_PAYMENT', record_id: id, event_type: 'PAID', reason: 'Salvador explicitly marked the worker paid', before_snapshot: payment, after_snapshot: payment ? { ...payment, status: 'PAID', paid_at: now } : null, actor_id: QA_FIXTURE_USER_ID, actor_label: 'Salvador', created_at: now }, ...current.financialHistory] } }); return } await markWorkerPaymentPaid(id); await refresh() }), [demo, launch, refresh])
  const voidWorkerPayment = useCallback((id: string, reason: string) => launch(async () => { if (demo.enabled) { const now = new Date().toISOString(); demo.updateData((current) => { const payment = current.workerPayments.find((row) => row.id === id); return { ...current, workerPayments: current.workerPayments.map((row) => row.id === id ? { ...row, status: 'VOID', voided_at: now, void_reason: reason, voided_by: QA_FIXTURE_USER_ID, updated_at: now } : row), financialHistory: [{ id: `qa-runtime-financial-${current.financialHistory.length + 1}`, record_type: 'WORKER_PAYMENT', record_id: id, event_type: 'VOIDED', reason, before_snapshot: payment, after_snapshot: null, actor_id: QA_FIXTURE_USER_ID, actor_label: 'Salvador', created_at: now }, ...current.financialHistory] } }); return } await voidFinancialRecord('WORKER_PAYMENT', id, reason); await refresh() }), [demo, launch, refresh])
  const voidPayment = useCallback((id: string, reason: string) => launch(async () => { if (demo.enabled) { const now = new Date().toISOString(); demo.updateData((current) => { const payment = current.payments.find((row) => row.id === id); return { ...current, payments: current.payments.map((row) => row.id === id ? { ...row, voided_at: now, void_reason: reason, voided_by: QA_FIXTURE_USER_ID } : row), invoices: current.invoices.map((row) => row.id === payment?.invoice_id ? { ...row, status: 'SENT', paid_at: null, updated_at: now } : row), financialHistory: [{ id: `qa-runtime-financial-${current.financialHistory.length + 1}`, record_type: 'PAYMENT', record_id: id, event_type: 'VOIDED', reason, before_snapshot: payment, after_snapshot: null, actor_id: QA_FIXTURE_USER_ID, actor_label: 'Salvador', created_at: now }, ...current.financialHistory] } }); return } await voidFinancialRecord('PAYMENT', id, reason); await refresh() }), [demo, launch, refresh])

  const snoozeAttention = useCallback((id: string) => {
    const item = derivedAttention.find((entry) => entry.id === id); if (!item || (!user?.id && !demo.enabled)) return
    const returns = new Date(); if (returns.getHours() >= 7) returns.setDate(returns.getDate() + 1); returns.setHours(7, 0, 0, 0)
    setLastAction({ item, outcome: 'snoozed' })
    if (demo.enabled) {
      demo.updateData((current) => ({ ...current, snoozes: [...current.snoozes.filter((row) => row.fingerprint !== id), { id: `qa-runtime-snooze-${current.snoozes.length + 1}`, user_id: QA_FIXTURE_USER_ID, fingerprint: id, returns_at: returns.toISOString(), created_at: new Date().toISOString() }] }))
      return
    }
    launch(async () => { await persistSnooze(user.id, id, returns.toISOString()); await refresh() })
  }, [demo, derivedAttention, launch, refresh, user?.id])
  const unsnoozeAttention = useCallback((id: string) => launch(async () => { if (demo.enabled) { demo.updateData((current) => ({ ...current, snoozes: current.snoozes.filter((row) => row.fingerprint !== id) })); return } if (!user?.id) return; const { error: updateError } = await controlDb.from('attention_snoozes').update({ returns_at: new Date().toISOString() }).eq('user_id', user.id).eq('fingerprint', id); if (updateError) throw new Error(updateError.message); await refresh() }), [demo, launch, refresh, user?.id])
  const undoLastAction = useCallback(() => { if (lastAction) unsnoozeAttention(lastAction.item.id); setLastAction(null) }, [lastAction, unsnoozeAttention])

  const cycleSync = useCallback(() => {
    if (!demo.enabled) { window.dispatchEvent(new Event('online')); return }
    const now = new Date().toISOString()
    demo.updateData((current) => {
      let next = Number(current.appSettings?.next_ticket_number ?? 1)
      const allocated = new Map<string, string>()
      current.tickets
        .filter((row) => row.status === 'pending')
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
        .forEach((row) => {
          allocated.set(row.id, `${current.appSettings?.ticket_prefix ?? 'MT'}${next}`)
          next += 1
        })
      const tickets = current.tickets.map((row) => {
        const ticketNumber = allocated.get(row.id)
        return ticketNumber
          ? { ...row, ticket_number: ticketNumber, status: 'saved', updated_at: now }
          : row
      })
      return { ...current, tickets, appSettings: current.appSettings ? { ...current.appSettings, next_ticket_number: next, updated_at: now } : null }
    })
    setLastSyncAt(Date.now())
  }, [demo])

  const value = useMemo<AppStateValue>(() => ({
    period, setPeriod, money, pipeline, todayJobs, attention, visibleAttention, snoozedItems, openCount: attention.length,
    showAllAttention, toggleShowAllAttention: () => setShowAllAttention((current) => !current), snoozeAttention, unsnoozeAttention, lastAction, undoLastAction,
    booting: loading, moneyLoading, sync: demo.enabled && pendingTickets > 0 ? 'offline' : !online ? 'offline' : syncing ? 'syncing' : 'synced', queued: pendingTickets, lastSyncAt,
    cycleSync,
    newSheetOpen, setNewSheetOpen, newLeadSheetOpen, setNewLeadSheetOpen, newJobSheetOpen, setNewJobSheetOpen, pinnedBarActive, setPinnedBarActive,
    customers, leads, quotes, activities, customerById, leadById, quoteById, leadsForCustomer, quotesForCustomer, activitiesForCustomer,
    jobs, jobById, jobsForDay, jobsForCustomer, photoJobsForCustomer, unscheduledQuotes, scheduleJob, rescheduleJob, completeJob, cancelJob, startJob, updateJobNotes,
    tickets, ticketById, ticketsForJob, ticketsForCustomer, saveTicket, updateTicket, voidTicket, deleteTicket, printTicket,
    invoices, payments, workers, workerPayments, invoiceById, invoiceForJob, invoiceForTicket, paymentsForInvoice, workerPaymentsFor,
    createInvoiceFromJob, createInvoiceFromTicket, reviseInvoice, sendInvoice, resendInvoice, voidInvoice, recordPayment, addHourlyWorkerPay, addDriverWorkerPay, confirmWorkerPayDetails, markWorkerPayPaid, voidWorkerPayment, voidPayment,
    findDuplicate, createLead, createCustomer, replyToLead, updateLeadNotes, updateCustomerNotes, createQuoteFromLead, updateQuoteMeta, addMaterialLine, removeMaterialLine, addCustomLine, removeCustomLine, setQuoteDelivery, setQuoteDeliveryLoads, sendQuote, acceptQuote, declineQuote,
    communicationReady: data?.controlSettings?.sms_status === 'READY', emailSendingFor, sourceData: data,
  }), [period, setPeriod, money, pipeline, todayJobs, attention, visibleAttention, snoozedItems, showAllAttention, snoozeAttention, unsnoozeAttention, lastAction, undoLastAction, loading, moneyLoading, demo.enabled, online, syncing, pendingTickets, lastSyncAt, cycleSync, newSheetOpen, newLeadSheetOpen, newJobSheetOpen, pinnedBarActive, customers, leads, quotes, activities, customerById, leadById, quoteById, leadsForCustomer, quotesForCustomer, activitiesForCustomer, jobs, jobById, jobsForDay, jobsForCustomer, photoJobsForCustomer, unscheduledQuotes, scheduleJob, rescheduleJob, completeJob, cancelJob, startJob, updateJobNotes, tickets, ticketById, ticketsForJob, ticketsForCustomer, saveTicket, updateTicket, voidTicket, deleteTicket, printTicket, invoices, payments, workers, workerPayments, invoiceById, invoiceForJob, invoiceForTicket, paymentsForInvoice, workerPaymentsFor, createInvoiceFromJob, createInvoiceFromTicket, reviseInvoice, sendInvoice, resendInvoice, voidInvoice, recordPayment, addHourlyWorkerPay, addDriverWorkerPay, confirmWorkerPayDetails, markWorkerPayPaid, voidWorkerPayment, voidPayment, findDuplicate, createLead, createCustomer, replyToLead, updateLeadNotes, updateCustomerNotes, createQuoteFromLead, updateQuoteMeta, addMaterialLine, removeMaterialLine, addCustomLine, removeCustomLine, setQuoteDelivery, setQuoteDeliveryLoads, sendQuote, acceptQuote, declineQuote, emailSendingFor, data])

  if (loading && !data) {
    return <div className="min-h-screen" aria-label="Loading Control Center" />
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="surface max-w-lg rounded-panel p-6 text-center">
          <h1 className="font-display text-[32px]">Control Center unavailable</h1>
          <p className="mt-2 text-cc-muted">The database could not be loaded. No fallback records have been substituted.</p>
        </div>
      </div>
    )
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('useAppState must be used inside AppStateProvider')
  return value
}
