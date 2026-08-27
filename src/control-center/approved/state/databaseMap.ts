import type { ControlData } from '@/control-center/data'
import type { Activity, Customer, Lead, Message, Quote, QuoteStatus } from './salesData'
import type { Job, JobCategory } from './jobsData'
import type { Invoice, Payment, Worker, WorkerPayment } from './moneyData'
import type { DeliveryMode, DeliverySelection, Material, MaterialLine } from './pricing'
import type { Ticket } from './ticketsData'

const at = (value: string | null | undefined) => (value ? new Date(value).getTime() : undefined)
const requiredAt = (value: string) => new Date(value).getTime()
const metadata = (value: ControlData['activities'][number]['metadata']) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

export function deliveryFromDatabase(type: string | null, miles?: number | null): DeliverySelection {
  const mode: DeliveryMode =
    type === 'tier_1' ? 'TIER_0_2'
      : type === 'tier_2' ? 'TIER_3_5'
        : type === 'tier_3' ? 'TIER_6_10'
          : type === 'over_10' ? 'OVER_10'
            : type === 'pickup' ? 'PICKUP'
              : type === 'custom' ? 'CUSTOM'
                : 'UNSET'
  return { mode, ...(mode === 'OVER_10' ? { miles: miles ?? 0 } : {}) }
}

export function deliveryToDatabase(delivery: DeliverySelection) {
  if (delivery.mode === 'TIER_0_2') return 'tier_1'
  if (delivery.mode === 'TIER_3_5') return 'tier_2'
  if (delivery.mode === 'TIER_6_10') return 'tier_3'
  if (delivery.mode === 'OVER_10') return 'over_10'
  if (delivery.mode === 'PICKUP') return 'pickup'
  if (delivery.mode === 'CUSTOM') return 'custom'
  return ''
}

export function mapMaterials(data: ControlData): Material[] {
  return data.materials.map((row) => ({
    id: row.id,
    name: row.name,
    pricePerYard: Number(row.price_per_yard),
    fullLoadPrice: Number(row.full_load_price),
    fullLoadYards: Number(row.full_load_yards),
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }))
}

function messageActor(sender: ControlData['messages'][number]['sender_type']): Message['actor'] {
  if (sender === 'CUSTOMER') return 'customer'
  if (sender === 'AI') return 'ai'
  if (sender === 'HUMAN') return 'salvador'
  return 'system'
}

export function mapCustomers(data: ControlData): Customer[] {
  const firstSource = new Map<string, string>()
  data.leads
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .forEach((lead) => { if (!firstSource.has(lead.customer_id)) firstSource.set(lead.customer_id, lead.source) })
  return data.customers.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone ?? '',
    email: row.email ?? undefined,
    source: firstSource.get(row.id) ?? 'Other',
    notes: row.notes ?? '',
    createdAt: requiredAt(row.created_at),
  }))
}

export function mapLeads(data: ControlData): Lead[] {
  return data.leads.map((row) => {
    const messages = data.messages
      .filter((message) => message.lead_id === row.id)
      .map<Message>((message) => ({
        id: message.id,
        actor: messageActor(message.sender_type),
        at: requiredAt(message.created_at),
        text: message.body,
        escalation: message.sender_type === 'SYSTEM' && /salvador|human/i.test(message.body),
      }))
    const quote = data.quotes.find((entry) => entry.lead_id === row.id && entry.status !== 'VOID')
    const aiState = data.aiConversationStates?.find((entry) => entry.lead_id === row.id)
    const latestAiAudit = data.aiAuditLogs?.find((entry) => entry.lead_id === row.id)
    const aiDecision = latestAiAudit?.decision && typeof latestAiAudit.decision === 'object' && !Array.isArray(latestAiAudit.decision)
      ? latestAiAudit.decision as Record<string, unknown>
      : null
    const knownFacts = Array.isArray(aiState?.known_facts)
      ? aiState.known_facts.flatMap((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return []
          const fact = item as Record<string, unknown>
          return typeof fact.key === 'string' && typeof fact.value === 'string'
            ? [{ label: fact.key.replaceAll('_', ' '), value: fact.value }]
            : []
        })
      : []
    const missingFacts = Array.isArray(aiState?.missing_facts)
      ? aiState.missing_facts.filter((item): item is string => typeof item === 'string')
      : []
    const latestMessageAt = messages.reduce((latest, message) => Math.max(latest, message.at), 0)
    const lastCustomer = [...messages].reverse().find((message) => message.actor === 'customer')
    const lastHuman = [...messages].reverse().find((message) => message.actor === 'salvador')
    return {
      id: row.id,
      customerId: row.customer_id,
      status: row.status === 'ACTIVE' ? 'TALKING' : row.status,
      need: row.need,
      source: row.source,
      campaign: row.campaign ?? undefined,
      createdAt: requiredAt(row.created_at),
      lastActivityAt: Math.max(requiredAt(row.updated_at), latestMessageAt),
      needsSalvador: Boolean(
        (!row.human_takeover && (latestAiAudit?.status === 'FAILED' || aiDecision?.requires_human === true)) ||
        (lastCustomer && (!lastHuman || lastCustomer.at > lastHuman.at) && !row.human_takeover),
      ),
      aiPaused: row.human_takeover,
      notes: row.notes ?? '',
      lostReason: row.lost_reason ?? undefined,
      quoteId: quote?.id,
      messages,
      known: knownFacts,
      missing: missingFacts,
    }
  })
}

function quoteLine(row: ControlData['quoteItems'][number]): MaterialLine {
  return {
    id: row.id,
    materialId: row.material_id ?? '',
    materialName: row.description,
    isFullLoad: row.is_full_load,
    loads: row.loads,
    yards: Number(row.yards ?? 0),
    rateUsed: Number(row.rate_used),
    lineTotal: Number(row.line_total),
  }
}

export function mapQuotes(data: ControlData): Quote[] {
  return data.quotes
    .filter((row) => row.status !== 'VOID' && Boolean(row.lead_id))
    .map((row) => ({
      id: row.id,
      number: row.quote_number,
      leadId: row.lead_id as string,
      customerId: row.customer_id,
      status: row.status as QuoteStatus,
      description: row.description,
      address: row.address,
      materialLines: data.quoteItems.filter((item) => item.quote_id === row.id && item.kind === 'MATERIAL').map(quoteLine),
      customLines: data.quoteItems
        .filter((item) => item.quote_id === row.id && item.kind === 'CUSTOM_WORK')
        .map((item) => ({ id: item.id, label: item.description, amount: Number(item.line_total) })),
      delivery: deliveryFromDatabase(row.delivery_type, row.delivery_miles),
      deliveryLoads: row.delivery_load_count,
      taxRate: Number(row.tax_rate),
      taxOnDelivery: row.tax_applies_to_delivery,
      customWorkTax: row.custom_work_tax_rule === 'EXEMPT' ? 'NOT_TAXED' : row.custom_work_tax_rule,
      createdAt: requiredAt(row.created_at),
      sentAt: at(row.sent_at),
      acceptedAt: at(row.accepted_at),
      declinedAt: at(row.declined_at),
      jobId: data.jobs.find((job) => job.quote_id === row.id)?.id,
      snapshotTotals: {
        materials: Number(row.materials_subtotal),
        custom: Number(row.custom_work_subtotal),
        delivery: Number(row.delivery_total),
        deliveryPerLoad: Number(row.delivery_fee_per_load),
        taxable: Number(row.tax_amount) / (Number(row.tax_rate) || 1),
        tax: Number(row.tax_amount),
        total: Number(row.grand_total),
        taxRate: Number(row.tax_rate),
        taxOnDelivery: row.tax_applies_to_delivery,
        customWorkTax: row.custom_work_tax_rule === 'EXEMPT' ? 'NOT_TAXED' : row.custom_work_tax_rule,
        customTaxed: row.custom_work_tax_rule === 'TAXED',
      },
    }))
}

function jobCategory(category: ControlData['jobs'][number]['category']): JobCategory {
  return category === 'DEMOLITION' ? 'OTHER' : category
}

export function mapJobs(data: ControlData): Job[] {
  return data.jobs.map((row) => {
    const photos = data.activities
      .filter((entry) => entry.entity_type === 'JOB' && entry.entity_id === row.id)
      .flatMap((entry) => {
        const value = metadata(entry.metadata).photos
        return Array.isArray(value) ? value.filter((photo): photo is string => typeof photo === 'string') : []
      })
    return {
    id: row.id,
    customerId: row.customer_id,
    quoteId: row.quote_id ?? undefined,
    category: jobCategory(row.category),
    status: row.status,
    date: row.scheduled_date,
    time: row.scheduled_time?.slice(0, 5) || undefined,
    allDay: row.all_day,
    address: row.address,
    description: row.description,
    agreedAmount: Number(row.agreed_amount),
    notes: row.notes ?? '',
    photos,
    invoiceId: data.invoices.find((invoice) => invoice.job_id === row.id && invoice.status !== 'VOID')?.id,
    changeRequested: row.change_requested,
    blocked: row.blocked_reason ?? undefined,
    blockedAt: at(row.blocked_at),
    createdAt: requiredAt(row.created_at),
    completedAt: at(row.completed_at),
    cancelledAt: at(row.cancelled_at),
    cancelReason: row.cancellation_reason ?? undefined,
    }
  })
}

export function mapTickets(data: ControlData): Ticket[] {
  return data.tickets.map((row) => {
    const edits = data.ticketHistory
      .filter((entry) => entry.ticket_id === row.id && !/created|context_linked/i.test(entry.event_type))
      .map((entry) => ({ at: requiredAt(entry.created_at), note: entry.reason ?? entry.event_type }))
    return {
      id: row.id,
      number: row.ticket_number || undefined,
      customerId: row.customer_id ?? `legacy:${row.id}`,
      jobId: row.job_id ?? undefined,
      driverId: row.driver_id ?? '',
      address: row.job_site_address,
      materialLines: data.ticketItems.filter((item) => item.ticket_id === row.id).map((item) => ({
        id: item.id,
        materialId: item.material_id ?? '',
        materialName: item.material_name,
        isFullLoad: item.is_full_load,
        loads: item.loads,
        yards: Number(item.yards),
        rateUsed: Number(item.rate_used),
        lineTotal: Number(item.line_total),
      })),
      delivery: deliveryFromDatabase(row.delivery_type, row.delivery_miles),
      deliveryLoads: row.load_count,
      taxRate: Number(row.tax_rate),
      taxOnDelivery: row.tax_applies_to_delivery ?? false,
      notes: row.notes ?? '',
      status: row.status.toLowerCase() === 'void' ? 'VOID' : 'SAVED',
      sync: row.status.toLowerCase() === 'pending' ? 'PENDING' : 'SYNCED',
      createdAt: requiredAt(row.created_at),
      printedAt: at(row.printed_at),
      printCount: row.printed_at ? 1 : 0,
      voidedAt: at(row.voided_at),
      voidReason: row.void_reason ?? undefined,
      edits,
      legacyPaymentStatus: row.payment_status === 'paid' ? 'PAID' : row.payment_status === 'unpaid' ? 'UNPAID' : undefined,
      snapshotTotals: {
        materials: Number(row.materials_subtotal),
        custom: 0,
        delivery: Number(row.delivery_total),
        deliveryPerLoad: Number(row.delivery_fee_per_load),
        taxable: Number(row.tax_amount) / (Number(row.tax_rate) || 1),
        tax: Number(row.tax_amount),
        total: Number(row.grand_total),
        taxRate: Number(row.tax_rate),
        taxOnDelivery: row.tax_applies_to_delivery ?? false,
        customWorkTax: 'PENDING',
        customTaxed: false,
      },
    }
  })
}

export function mapInvoices(data: ControlData): Invoice[] {
  return data.invoices.map((row) => ({
    id: row.id,
    number: row.invoice_number,
    customerId: row.customer_id,
    jobId: row.job_id ?? undefined,
    quoteId: row.quote_id ?? undefined,
    ticketIds: data.invoiceTickets.filter((entry) => entry.invoice_id === row.id).map((entry) => entry.ticket_id),
    description: row.description,
    amount: Number(row.amount),
    amountSource: row.amount_source,
    status: row.status,
    createdAt: requiredAt(row.created_at),
    issuedAt: at(row.issued_at),
    dueAt: at(row.due_at),
    paidAt: at(row.paid_at),
    voidedAt: at(row.voided_at),
    voidReason: row.void_reason ?? undefined,
    disputed: row.disputed,
    disputeNote: row.dispute_note ?? undefined,
    claimedPaid: row.payment_claimed_at ? {
      at: requiredAt(row.payment_claimed_at),
      method: (row.payment_claim_method ?? 'OTHER') as Payment['method'],
      note: row.payment_claim_note ?? '',
    } : undefined,
    followUps: data.activities
      .filter((entry) => entry.entity_type === 'INVOICE' && entry.entity_id === row.id && /follow.?up/i.test(entry.event_type))
      .map((entry) => ({ at: requiredAt(entry.created_at), label: entry.summary })),
    history: financialHistory(data, 'INVOICE', row.id),
    voidedBy: row.voided_by ?? undefined,
  }))
}

export function mapPayments(data: ControlData): Payment[] {
  return data.payments.map((row) => ({
    id: row.id,
    invoiceId: row.invoice_id,
    customerId: row.customer_id,
    amount: Number(row.amount),
    method: row.method,
    receivedAt: requiredAt(row.received_at),
    recordedAt: requiredAt(row.recorded_at),
    confirmedBy: row.confirmed_by,
    note: row.note ?? '',
    history: financialHistory(data, 'PAYMENT', row.id),
    voidedAt: at(row.voided_at),
    voidReason: row.void_reason ?? undefined,
    voidedBy: row.voided_by ?? undefined,
  }))
}

export function mapWorkers(data: ControlData): Worker[] {
  return data.workers.map((row) => ({
    id: row.id,
    name: row.name,
    payType: row.pay_type,
    hourlyRate: row.hourly_rate == null ? undefined : Number(row.hourly_rate),
    isDriver: row.is_driver,
    isActive: row.is_active,
    notes: row.notes ?? '',
  }))
}

export function mapWorkerPayments(data: ControlData): WorkerPayment[] {
  return data.workerPayments.map((row) => ({
    id: row.id,
    workerId: row.worker_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    hours: row.hours == null ? undefined : Number(row.hours),
    rate: row.rate == null ? undefined : Number(row.rate),
    amount: Number(row.amount),
    status: row.status === 'VOID' ? 'PENDING' : row.status,
    source: row.source,
    attachmentName: row.attachment_path?.split('/').at(-1),
    createdAt: requiredAt(row.created_at),
    confirmedAt: at(row.confirmed_at),
    paidAt: at(row.paid_at),
    history: financialHistory(data, 'WORKER_PAYMENT', row.id),
    voidedAt: at(row.voided_at),
    voidReason: row.void_reason ?? undefined,
    voidedBy: row.voided_by ?? undefined,
  }))
}

function financialHistory(
  data: ControlData,
  recordType: 'INVOICE' | 'PAYMENT' | 'WORKER_PAYMENT',
  recordId: string,
) {
  return data.financialHistory
    .filter((entry) => entry.record_type === recordType && entry.record_id === recordId)
    .map((entry) => ({
      at: requiredAt(entry.created_at),
      actor: entry.actor_label ?? entry.actor_id ?? 'System',
      note: `${entry.event_type.replaceAll('_', ' ').toLowerCase()}: ${entry.reason}`,
    }))
}

export function mapActivities(data: ControlData): Activity[] {
  const kind = (value: string): Activity['kind'] => {
    const lower = value.toLowerCase()
    if (lower === 'invoice' || lower === 'payment') return 'money'
    if (lower === 'lead' || lower === 'quote' || lower === 'job' || lower === 'ticket') return lower
    return 'note'
  }
  return data.activities
    .filter((row) => Boolean(row.customer_id))
    .map((row) => {
      const details = metadata(row.metadata)
      const photos = Array.isArray(details.photos)
        ? details.photos.filter((photo): photo is string => typeof photo === 'string')
        : undefined
      return {
        id: row.id,
        customerId: row.customer_id as string,
        kind: kind(row.entity_type),
        at: requiredAt(row.created_at),
        title: row.summary,
        body: typeof details.body === 'string' ? details.body : undefined,
        amount: typeof details.amount === 'number' ? details.amount : undefined,
        photos,
        ref: row.entity_id ?? undefined,
      }
    })
}
