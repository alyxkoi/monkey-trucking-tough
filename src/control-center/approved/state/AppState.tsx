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
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import {
  addLeadMessage,
  confirmWorkerPayment,
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
  saveQuoteChanges,
  snoozeAttention as persistSnooze,
  updateInvoice,
  updateJob,
  updateLead,
  updateQuote,
  voidFinancialRecord,
  type ControlData,
  type QuoteDraft,
} from '@/control-center/data'
import { useControlCenter } from '@/control-center/context'
import {
  correctTicket,
  getQueue,
  saveTicket as saveTicketRecord,
  voidTicket as voidTicketRecord,
  type TicketDraft,
} from '@/lib/admin/tickets'
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
  sourceData: ControlData | null
}

const AppStateContext = createContext<AppStateValue | null>(null)
const fail = (error: unknown) => toast.error(error instanceof Error ? error.message : 'That did not go through')

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { data, loading, error, refresh, pendingTickets, syncing } = useControlCenter()
  const [period, setPeriodState] = useState<Period>('MTD')
  const [moneyLoading, setMoneyLoading] = useState(false)
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
        taxable: entry.draft.tax_amount / (entry.draft.tax_rate || 1),
        tax: entry.draft.tax_amount,
        total: entry.draft.grand_total,
        taxRate: entry.draft.tax_rate,
        taxOnDelivery: entry.draft.tax_applies_to_delivery ?? false,
        customWorkTax: 'PENDING',
      },
    }))
  }, [pendingVersion, user?.id])
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
  const derivedAttention = useMemo(() => deriveAttention({ leads, quotes, jobs, invoices, customers, today: dateKey(new Date()) }), [customers, invoices, jobs, leads, quotes])
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
    const row = await refreshAfter(() => findOrCreateCustomer(input))
    return { id: row.id, name: row.name, phone: row.phone ?? '', email: row.email ?? undefined, source: 'Other', notes: row.notes ?? '', createdAt: new Date(row.created_at).getTime() }
  }, [refreshAfter])
  const createLead = useCallback(async (input: NewLeadInput) => {
    const rows = await refreshAfter(() => createLeadRecord({ ...input, source: input.source as Parameters<typeof createLeadRecord>[0]['source'] }))
    const row = rows[0]
    if (!row) throw new Error('Lead creation returned no record')
    return { leadId: row.lead_id, customerId: row.customer_id, matchedExisting: row.matched_existing, customerName: input.name }
  }, [refreshAfter])
  const scheduleJob = useCallback((input: ScheduleJobInput) => refreshAfter(() => createJobRecord({ ...input, category: input.category as Parameters<typeof createJobRecord>[0]['category'] })), [refreshAfter])
  const rescheduleJob = useCallback((id: string, when: { date: string; time?: string; allDay: boolean }) => launch(async () => { await updateJob(id, { scheduled_date: when.date, scheduled_time: when.allDay ? null : when.time ?? null, all_day: when.allDay, change_requested: false }); await refresh() }), [launch, refresh])
  const completeJob = useCallback((id: string) => launch(async () => { await updateJob(id, { status: 'COMPLETED', completed_at: new Date().toISOString() }); await refresh() }), [launch, refresh])
  const cancelJob = useCallback((id: string, reason: string) => launch(async () => { await updateJob(id, { status: 'CANCELLED', cancelled_at: new Date().toISOString(), cancellation_reason: reason }); await refresh() }), [launch, refresh])
  const startJob = useCallback((id: string) => launch(async () => { await updateJob(id, { status: 'IN_PROGRESS' }); await refresh() }), [launch, refresh])
  const debounce = useCallback((key: string, work: () => Promise<unknown>) => { window.clearTimeout(noteTimers.current[key]); noteTimers.current[key] = window.setTimeout(() => launch(work), 500) }, [launch])
  const updateJobNotes = useCallback((id: string, notes: string) => debounce(`job:${id}`, async () => { await updateJob(id, { notes }); await refresh() }), [debounce, refresh])
  const updateLeadNotes = useCallback((id: string, notes: string) => debounce(`lead:${id}`, async () => { await updateLead(id, { notes }); await refresh() }), [debounce, refresh])
  const updateCustomerNotes = useCallback((id: string, notes: string) => debounce(`customer:${id}`, async () => { const { error: saveError } = await controlDb.from('customers').update({ notes }).eq('id', id); if (saveError) throw new Error(saveError.message); await refresh() }), [debounce, refresh])
  const replyToLead = useCallback((id: string, text: string) => {
    const lead = leadById(id)
    if (!lead) return
    if (data?.controlSettings?.sms_status !== 'READY') { toast.error('SMS setup is required before a reply can be sent.'); return }
    launch(async () => { await addLeadMessage({ leadId: id, customerId: lead.customerId, body: text, deliveryStatus: 'PENDING' }); await refresh() })
  }, [data?.controlSettings?.sms_status, launch, leadById, refresh])

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
  const createQuoteFromLead = useCallback(async (id: string) => { const rows = await refreshAfter(() => createQuoteDraft(id)); return rows[0]?.id ?? '' }, [refreshAfter])
  const clearQuoteDraft = useCallback((id: string, expected?: Quote) => {
    const current = quoteDraftsRef.current
    if (expected && current[id] !== expected) return
    const next = { ...current }
    delete next[id]
    quoteDraftsRef.current = next
    setQuoteDrafts(next)
  }, [])
  const saveQuoteDraftNow = useCallback(async (quote: Quote) => {
    await saveQuoteChanges(quote.id, quoteDraft({ ...quote, snapshotTotals: undefined }))
    await refresh()
    clearQuoteDraft(quote.id, quote)
  }, [clearQuoteDraft, quoteDraft, refresh])
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
    const current = quoteDraftsRef.current[id] ?? quoteById(id)
    if (current?.status === 'DRAFT') {
      window.clearTimeout(noteTimers.current[`quote:${id}`])
      await saveQuoteChanges(id, quoteDraft({ ...current, snapshotTotals: undefined }))
    }
    await updateQuote(id, { status: 'SENT', sent_at: new Date().toISOString() })
    clearQuoteDraft(id)
    await refresh()
    if (data?.controlSettings?.sms_status !== 'READY') toast.info('Quote marked sent. Customer delivery is setup-required until SMS is connected.')
  }), [clearQuoteDraft, data?.controlSettings?.sms_status, launch, quoteById, quoteDraft, refresh])
  const acceptQuote = useCallback((id: string) => launch(async () => { await updateQuote(id, { status: 'ACCEPTED', accepted_at: new Date().toISOString() }); await refresh() }), [launch, refresh])
  const declineQuote = useCallback((id: string) => launch(async () => { await updateQuote(id, { status: 'DECLINED', declined_at: new Date().toISOString() }); await refresh() }), [launch, refresh])

  const toTicketDraft = useCallback((input: SaveTicketInput): TicketDraft => {
    const customer = customerById(input.customerId)
    const fee = deliveryFeePerLoad(input.delivery)
    const taxRate = Number(data?.appSettings?.tax_rate ?? 0)
    const taxOnDelivery = data?.appSettings?.tax_applies_to_delivery ?? true
    const totals = computeTotals({ materialLines: input.materialLines, customLines: [], delivery: input.delivery, deliveryLoads: input.deliveryLoads, taxRate, taxOnDelivery })
    return {
      customer_name: customer?.name ?? '', customer_phone: customer?.phone ?? '', job_site_address: input.address,
      driver_id: input.driverId || null, delivery_type: deliveryToDatabase(input.delivery), delivery_miles: input.delivery.miles ?? null,
      delivery_fee_per_load: fee, load_count: input.deliveryLoads, delivery_total: totals.delivery,
      materials_subtotal: totals.materials, tax_rate: taxRate, tax_applies_to_delivery: taxOnDelivery,
      tax_amount: totals.tax, grand_total: totals.total, notes: input.notes || null,
      items: input.materialLines.map((line) => ({ source_item_id: line.id, material_id: line.materialId || null, material_name: line.materialName, yards: line.yards, is_full_load: line.isFullLoad, rate_used: line.rateUsed, line_total: line.lineTotal, loads: line.loads })),
    }
  }, [customerById, data?.appSettings?.tax_applies_to_delivery, data?.appSettings?.tax_rate])
  const saveTicket = useCallback(async (input: SaveTicketInput) => {
    if (!user?.id) throw new Error('Sign in is required')
    const result = await saveTicketRecord(toTicketDraft(input), user.id, { customerId: input.customerId, jobId: input.jobId })
    setPendingVersion((value) => value + 1)
    if (!result.queued) await refresh()
    return result.queued ? result.requestId : result.ticket.id
  }, [refresh, toTicketDraft, user?.id])
  const updateTicket = useCallback(async (id: string, input: SaveTicketInput, note: string) => { await correctTicket(id, note, toTicketDraft(input)); await refresh() }, [refresh, toTicketDraft])
  const voidTicket = useCallback((id: string, reason: string) => launch(async () => { await voidTicketRecord(id, reason); await refresh() }), [launch, refresh])
  const printTicket = useCallback((id: string) => {
    const ticket = ticketById(id); if (!ticket || !ticket.number) return
    const customer = customerById(ticket.customerId); const totals = ticketTotals(ticket)
    launch(async () => {
      const blob = await renderTicketPng({
        companyName: data?.appSettings?.company_name ?? 'Monkey Trucking LLC', companyTagline: 'Material and delivery ticket',
        companyAddress: data?.appSettings?.company_address ?? '', companyCityStateZip: data?.appSettings?.company_city_state_zip ?? '', companyPhone: data?.appSettings?.company_phone ?? '',
        ticketNumber: ticket.number as string, createdAt: new Date(ticket.createdAt), customerName: customer?.name ?? '', customerPhone: customer?.phone ?? '', jobSiteAddress: ticket.address,
        items: ticket.materialLines.map((line) => ({ name: line.materialName, detail: line.isFullLoad && line.loads !== null ? `${line.loads} load${line.loads === 1 ? '' : 's'} / ${line.yards} yd` : `${line.yards} yd`, amount: `$${line.lineTotal.toFixed(2)}` })),
        subtotal: `$${totals.materials.toFixed(2)}`, deliveryLabel: 'Delivery', deliveryAmount: `$${totals.delivery.toFixed(2)}`, taxLabel: `Tax ${(totals.taxRate * 100).toFixed(2)}%`, taxAmount: `$${totals.tax.toFixed(2)}`, total: `$${totals.total.toFixed(2)}`,
        driver: data?.drivers.find((driver) => driver.id === ticket.driverId)?.name ?? '', notes: ticket.notes, copies: data?.appSettings?.print_copies ?? 1,
      })
      await outputTicketPng(blob, data?.appSettings?.print_method === 'direct' ? 'direct' : 'share', `${ticket.number}.png`, `Ticket ${ticket.number}`)
      await supabase.from('tickets').update({ printed_at: new Date().toISOString() }).eq('id', id)
      await refresh()
    })
  }, [customerById, data, launch, refresh, ticketById])

  const createInvoiceFromJob = useCallback((id: string) => refreshAfter(() => createInvoiceFromJobRecord(id)), [refreshAfter])
  const createInvoiceFromTicket = useCallback((id: string) => refreshAfter(() => createInvoiceFromTicketRecord(id)), [refreshAfter])
  const sendInvoice = useCallback((id: string) => launch(async () => { const due = new Date(); due.setDate(due.getDate() + (data?.controlSettings?.default_invoice_due_days ?? 3)); await updateInvoice(id, { status: 'SENT', issued_at: new Date().toISOString(), due_at: due.toISOString() }); await refresh(); if (data?.controlSettings?.sms_status !== 'READY') toast.info('Invoice marked sent. Customer delivery is setup-required until SMS is connected.') }), [data?.controlSettings, launch, refresh])
  const resendInvoice = useCallback((_id: string) => toast.info('SMS setup is required before an invoice can be resent.'), [])
  const voidInvoice = useCallback((id: string, reason: string) => launch(async () => { await voidFinancialRecord('INVOICE', id, reason); await refresh() }), [launch, refresh])
  const recordPayment = useCallback((input: { invoiceId: string; amount: number; method: PaymentMethod; receivedAt: number; note: string }) => launch(async () => { await recordPaymentRecord(input.invoiceId, input.method, input.note); await refresh() }), [launch, refresh])
  const addHourlyWorkerPay = useCallback((input: { workerId: string; periodStart: string; periodEnd: string; hours: number; rate: number }) => launch(async () => { await createWorkerPayment({ ...input, amount: input.hours * input.rate, source: 'MANUAL' }); await refresh() }), [launch, refresh])
  const addDriverWorkerPay = useCallback((input: { workerId: string; periodStart: string; periodEnd: string; amount: number; attachmentName: string }) => launch(async () => { await createWorkerPayment({ workerId: input.workerId, periodStart: input.periodStart, periodEnd: input.periodEnd, amount: input.amount, source: 'DRIVER_INVOICE', attachmentPath: input.attachmentName }); await refresh() }), [launch, refresh])
  const confirmWorkerPayDetails = useCallback((id: string) => launch(async () => { await confirmWorkerPayment(id); await refresh() }), [launch, refresh])
  const markWorkerPayPaid = useCallback((id: string) => launch(async () => { await markWorkerPaymentPaid(id); await refresh() }), [launch, refresh])
  const voidWorkerPayment = useCallback((id: string, reason: string) => launch(async () => { await voidFinancialRecord('WORKER_PAYMENT', id, reason); await refresh() }), [launch, refresh])
  const voidPayment = useCallback((id: string, reason: string) => launch(async () => { await voidFinancialRecord('PAYMENT', id, reason); await refresh() }), [launch, refresh])

  const snoozeAttention = useCallback((id: string) => {
    const item = derivedAttention.find((entry) => entry.id === id); if (!item || !user?.id) return
    const returns = new Date(); if (returns.getHours() >= 7) returns.setDate(returns.getDate() + 1); returns.setHours(7, 0, 0, 0)
    setLastAction({ item, outcome: 'snoozed' })
    launch(async () => { await persistSnooze(user.id, id, returns.toISOString()); await refresh() })
  }, [derivedAttention, launch, refresh, user?.id])
  const unsnoozeAttention = useCallback((id: string) => launch(async () => { if (!user?.id) return; const { error: updateError } = await controlDb.from('attention_snoozes').update({ returns_at: new Date().toISOString() }).eq('user_id', user.id).eq('fingerprint', id); if (updateError) throw new Error(updateError.message); await refresh() }), [launch, refresh, user?.id])
  const undoLastAction = useCallback(() => { if (lastAction) unsnoozeAttention(lastAction.item.id); setLastAction(null) }, [lastAction, unsnoozeAttention])

  const value = useMemo<AppStateValue>(() => ({
    period, setPeriod, money, pipeline, todayJobs, attention, visibleAttention, snoozedItems, openCount: attention.length,
    showAllAttention, toggleShowAllAttention: () => setShowAllAttention((current) => !current), snoozeAttention, unsnoozeAttention, lastAction, undoLastAction,
    booting: loading, moneyLoading, sync: !online ? 'offline' : syncing ? 'syncing' : 'synced', queued: pendingTickets, lastSyncAt,
    cycleSync: () => window.dispatchEvent(new Event('online')),
    newSheetOpen, setNewSheetOpen, newLeadSheetOpen, setNewLeadSheetOpen, newJobSheetOpen, setNewJobSheetOpen, pinnedBarActive, setPinnedBarActive,
    customers, leads, quotes, activities, customerById, leadById, quoteById, leadsForCustomer, quotesForCustomer, activitiesForCustomer,
    jobs, jobById, jobsForDay, jobsForCustomer, photoJobsForCustomer, unscheduledQuotes, scheduleJob, rescheduleJob, completeJob, cancelJob, startJob, updateJobNotes,
    tickets, ticketById, ticketsForJob, ticketsForCustomer, saveTicket, updateTicket, voidTicket, printTicket,
    invoices, payments, workers, workerPayments, invoiceById, invoiceForJob, invoiceForTicket, paymentsForInvoice, workerPaymentsFor,
    createInvoiceFromJob, createInvoiceFromTicket, sendInvoice, resendInvoice, voidInvoice, recordPayment, addHourlyWorkerPay, addDriverWorkerPay, confirmWorkerPayDetails, markWorkerPayPaid, voidWorkerPayment, voidPayment,
    findDuplicate, createLead, createCustomer, replyToLead, updateLeadNotes, updateCustomerNotes, createQuoteFromLead, updateQuoteMeta, addMaterialLine, removeMaterialLine, addCustomLine, removeCustomLine, setQuoteDelivery, setQuoteDeliveryLoads, sendQuote, acceptQuote, declineQuote,
    communicationReady: data?.controlSettings?.sms_status === 'READY', sourceData: data,
  }), [period, setPeriod, money, pipeline, todayJobs, attention, visibleAttention, snoozedItems, showAllAttention, snoozeAttention, unsnoozeAttention, lastAction, undoLastAction, loading, moneyLoading, online, syncing, pendingTickets, lastSyncAt, newSheetOpen, newLeadSheetOpen, newJobSheetOpen, pinnedBarActive, customers, leads, quotes, activities, customerById, leadById, quoteById, leadsForCustomer, quotesForCustomer, activitiesForCustomer, jobs, jobById, jobsForDay, jobsForCustomer, photoJobsForCustomer, unscheduledQuotes, scheduleJob, rescheduleJob, completeJob, cancelJob, startJob, updateJobNotes, tickets, ticketById, ticketsForJob, ticketsForCustomer, saveTicket, updateTicket, voidTicket, printTicket, invoices, payments, workers, workerPayments, invoiceById, invoiceForJob, invoiceForTicket, paymentsForInvoice, workerPaymentsFor, createInvoiceFromJob, createInvoiceFromTicket, sendInvoice, resendInvoice, voidInvoice, recordPayment, addHourlyWorkerPay, addDriverWorkerPay, confirmWorkerPayDetails, markWorkerPayPaid, voidWorkerPayment, voidPayment, findDuplicate, createLead, createCustomer, replyToLead, updateLeadNotes, updateCustomerNotes, createQuoteFromLead, updateQuoteMeta, addMaterialLine, removeMaterialLine, addCustomLine, removeCustomLine, setQuoteDelivery, setQuoteDeliveryLoads, sendQuote, acceptQuote, declineQuote, data])

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
