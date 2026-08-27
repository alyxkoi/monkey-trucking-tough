import drivewayPhoto from '@/assets/projects/gravel-driveway.webp'
import regradePhoto from '@/assets/projects/driveway-regrading.webp'
import deliveryPhoto from '@/assets/projects/crushed-concrete-delivery.webp'
import type {
  Activity,
  AutomationRule,
  ControlData,
  Customer,
  FinancialHistory,
  Invoice,
  Job,
  Lead,
  LeadMessage,
  Payment,
  Quote,
  QuoteItem,
  TrackingLink,
  Worker,
  WorkerPayment,
} from '@/control-center/data'
import { QA_FIXTURE_USER_ID, QA_MISSING_DELIVERY_CUSTOMER_ID, QA_MISSING_DELIVERY_MATERIAL_ID } from './constants'

export { QA_FIXTURE_USER_ID, QA_MISSING_DELIVERY_CUSTOMER_ID, QA_MISSING_DELIVERY_MATERIAL_ID } from './constants'

const DAY = 24 * 60 * 60 * 1000

function fixtureClock(reference = new Date()) {
  const anchor = new Date(reference)
  anchor.setHours(12, 0, 0, 0)
  const at = (days: number, hour = 12, minute = 0) => {
    const value = new Date(anchor)
    value.setDate(value.getDate() + days)
    value.setHours(hour, minute, 0, 0)
    return value.toISOString()
  }
  const day = (days: number) => at(days).slice(0, 10)
  return { anchor, at, day }
}

function digits(value: string) {
  return value.replace(/\D/g, '')
}

function customer(
  id: string,
  name: string,
  phone: string,
  email: string | null,
  createdAt: string,
  lastActivityAt: string,
  notes = '',
): Customer {
  return {
    id,
    name,
    phone,
    normalized_phone: digits(phone),
    email,
    normalized_email: email?.toLowerCase() ?? null,
    notes,
    sms_consent_at: createdAt,
    sms_consent_source: 'QA_FIXTURE',
    sms_opted_out_at: null,
    is_active: true,
    last_activity_at: lastActivityAt,
    created_by: QA_FIXTURE_USER_ID,
    created_at: createdAt,
    updated_at: lastActivityAt,
  }
}

function lead(
  id: string,
  customerId: string,
  status: Lead['status'],
  source: Lead['source'],
  need: string,
  createdAt: string,
  updatedAt: string,
  options: Partial<Lead> = {},
): Lead {
  return {
    id,
    customer_id: customerId,
    status,
    source,
    campaign: null,
    need,
    human_takeover: false,
    last_contact_at: updatedAt,
    lost_reason: null,
    notes: null,
    created_by: QA_FIXTURE_USER_ID,
    created_at: createdAt,
    updated_at: updatedAt,
    ...options,
  }
}

function message(
  id: string,
  leadId: string,
  customerId: string,
  sender: LeadMessage['sender_type'],
  body: string,
  createdAt: string,
): LeadMessage {
  return {
    id,
    lead_id: leadId,
    customer_id: customerId,
    sender_type: sender,
    body,
    delivery_status: sender === 'SYSTEM' ? 'INTERNAL' : 'DELIVERED',
    provider_message_id: null,
    created_by: sender === 'CUSTOMER' ? null : QA_FIXTURE_USER_ID,
    created_at: createdAt,
  }
}

function activity(
  id: string,
  customerId: string,
  entityType: string,
  entityId: string | null,
  eventType: string,
  summary: string,
  createdAt: string,
  metadata: Activity['metadata'] = {},
): Activity {
  return {
    id,
    customer_id: customerId,
    entity_type: entityType,
    entity_id: entityId,
    event_type: eventType,
    summary,
    metadata,
    actor_id: QA_FIXTURE_USER_ID,
    actor_label: 'Salvador',
    created_at: createdAt,
  }
}

function quote(
  id: string,
  number: string,
  customerId: string,
  leadId: string,
  status: Quote['status'],
  description: string,
  amount: number,
  createdAt: string,
  options: Partial<Quote> = {},
): Quote {
  return {
    id,
    quote_number: number,
    customer_id: customerId,
    lead_id: leadId,
    status,
    description,
    address: '',
    delivery_type: 'tier_2',
    delivery_miles: null,
    delivery_fee_per_load: 60,
    delivery_load_count: 1,
    delivery_total: 60,
    materials_subtotal: Math.max(0, amount - 60),
    custom_work_subtotal: 0,
    tax_rate: 0.0825,
    tax_applies_to_delivery: true,
    custom_work_tax_rule: 'PENDING',
    tax_amount: 0,
    grand_total: amount,
    notes: null,
    sent_at: status === 'DRAFT' ? null : createdAt,
    accepted_at: status === 'ACCEPTED' ? createdAt : null,
    declined_at: status === 'DECLINED' ? createdAt : null,
    voided_at: status === 'VOID' ? createdAt : null,
    void_reason: status === 'VOID' ? 'Fixture void example' : null,
    created_by: QA_FIXTURE_USER_ID,
    created_at: createdAt,
    updated_at: createdAt,
    ...options,
  }
}

function job(
  id: string,
  customerId: string,
  category: Job['category'],
  status: Job['status'],
  scheduledDate: string,
  description: string,
  address: string,
  amount: number,
  createdAt: string,
  options: Partial<Job> = {},
): Job {
  return {
    id,
    customer_id: customerId,
    quote_id: null,
    category,
    status,
    scheduled_date: scheduledDate,
    scheduled_time: '08:00:00',
    all_day: false,
    address,
    description,
    agreed_amount: amount,
    notes: null,
    blocked_reason: null,
    blocked_at: null,
    change_requested: false,
    completed_at: status === 'COMPLETED' ? createdAt : null,
    cancelled_at: status === 'CANCELLED' ? createdAt : null,
    cancellation_reason: status === 'CANCELLED' ? 'Fixture cancellation example' : null,
    created_by: QA_FIXTURE_USER_ID,
    created_at: createdAt,
    updated_at: createdAt,
    ...options,
  }
}

function invoice(
  id: string,
  number: string,
  customerId: string,
  status: Invoice['status'],
  amount: number,
  description: string,
  createdAt: string,
  options: Partial<Invoice> = {},
): Invoice {
  return {
    id,
    invoice_number: number,
    customer_id: customerId,
    job_id: null,
    quote_id: null,
    standalone_ticket_id: null,
    amount_source: 'JOB',
    description,
    amount,
    status,
    issued_at: status === 'DRAFT' ? null : createdAt,
    due_at: null,
    paid_at: status === 'PAID' ? createdAt : null,
    disputed: false,
    dispute_note: null,
    payment_claimed_at: null,
    payment_claim_method: null,
    payment_claim_note: null,
    voided_at: status === 'VOID' ? createdAt : null,
    void_reason: status === 'VOID' ? 'Fixture void example' : null,
    voided_by: status === 'VOID' ? QA_FIXTURE_USER_ID : null,
    created_by: QA_FIXTURE_USER_ID,
    created_at: createdAt,
    updated_at: createdAt,
    ...options,
  }
}

function payment(
  id: string,
  invoiceId: string,
  customerId: string,
  amount: number,
  method: Payment['method'],
  receivedAt: string,
): Payment {
  return {
    id,
    invoice_id: invoiceId,
    customer_id: customerId,
    amount,
    method,
    confirmed_by: 'HUMAN',
    note: 'QA fixture payment',
    received_at: receivedAt,
    recorded_by: QA_FIXTURE_USER_ID,
    recorded_at: receivedAt,
    voided_at: null,
    void_reason: null,
    voided_by: null,
  }
}

function worker(
  id: string,
  name: string,
  payType: Worker['pay_type'],
  hourlyRate: number | null,
  isDriver: boolean,
  createdAt: string,
): Worker {
  return {
    id,
    name,
    pay_type: payType,
    hourly_rate: hourlyRate,
    is_driver: isDriver,
    is_active: true,
    notes: null,
    created_at: createdAt,
    updated_at: createdAt,
  }
}

function workerPayment(
  id: string,
  workerId: string,
  status: WorkerPayment['status'],
  source: WorkerPayment['source'],
  amount: number,
  periodStart: string,
  periodEnd: string,
  createdAt: string,
  options: Partial<WorkerPayment> = {},
): WorkerPayment {
  return {
    id,
    worker_id: workerId,
    period_start: periodStart,
    period_end: periodEnd,
    hours: null,
    rate: null,
    amount,
    status,
    source,
    attachment_path: null,
    confirmed_at: status === 'CONFIRMED' || status === 'PAID' ? createdAt : null,
    paid_at: status === 'PAID' ? createdAt : null,
    voided_at: status === 'VOID' ? createdAt : null,
    void_reason: status === 'VOID' ? 'Fixture void example' : null,
    voided_by: status === 'VOID' ? QA_FIXTURE_USER_ID : null,
    created_by: QA_FIXTURE_USER_ID,
    created_at: createdAt,
    updated_at: createdAt,
    ...options,
  }
}

export function createQaFixtureData(reference = new Date()): ControlData {
  const { at, day } = fixtureClock(reference)

  const customers: Customer[] = [
    customer('qa-customer-maya', 'Maya Turner', '(972) 555-0101', 'maya@example.com', at(-2), at(0, 8, 15)),
    customer('qa-customer-rancho', 'Rancho La Esperanza', '(972) 555-0155', null, at(-180), at(0, 9, 10), 'Habla español. Preguntar por Doña Chela.'),
    customer('qa-customer-kaufman-feed', 'Kaufman Feed', '(972) 555-0119', 'orders@kaufmanfeed.example', at(-420), at(-1), 'Repeat customer. Clear the loading dock before 7 am.'),
    customer('qa-customer-natalie', 'Natalie Briggs', '(469) 555-0124', 'natalie@example.com', at(-14), at(0, 9, 30)),
    customer('qa-customer-cedar', 'Cedar Creek Storage', '(214) 555-0181', 'office@cedarcreek.example', at(-70), at(-1)),
    customer('qa-customer-lopez', 'Lopez Materials', '(469) 555-0160', null, at(-90), at(-1)),
    customer('qa-customer-marisol', 'Marisol Vega', '(469) 555-0177', 'marisol@example.com', at(-20), at(-1)),
    customer('qa-customer-ortiz', 'Ortiz Ranch', '(972) 555-0142', 'office@ortizranch.example', at(-500), at(0, 7, 5), 'Gate code changes seasonally. Call before the first load.'),
    customer('qa-customer-ellis', 'Ellis Construction', '(903) 555-0148', 'ap@ellis.example', at(-240), at(-1)),
    customer('qa-customer-dwayne', 'Dwayne Roth', '(903) 555-0163', 'dwayne.roth@example.com', at(-300), at(0, 8, 45), 'Repeat customer. Pays by check or Zelle.'),
    customer('qa-customer-nina', 'Nina Carter', '(214) 555-0131', 'nina@example.com', at(-45), at(-2)),
    customer('qa-customer-joe', 'Joe Miller', '(972) 555-0149', null, at(-80), at(-1)),
    customer('qa-customer-riverbend', 'Riverbend Estates', '(469) 555-0190', 'manager@riverbend.example', at(-130), at(-1)),
    customer('qa-customer-review', 'Angela Price', '(972) 555-0114', 'angela@example.com', at(-100), at(-2)),
    customer('qa-customer-reactivation', 'Parker Family Farm', '(903) 555-0107', null, at(-400), at(-65)),
    customer(QA_MISSING_DELIVERY_CUSTOMER_ID, 'Arturo Martinez', '(972) 555-0182', 'arturo@example.com', at(-220), at(-4), 'Duplicate-match fixture: use this phone or email.'),
    customer('qa-customer-empty', 'Empty State Test', '(972) 555-0199', null, at(-1), at(-1)),
  ]

  const leads: Lead[] = [
    lead('qa-lead-facebook', 'qa-customer-maya', 'NEW', 'Facebook', 'Two loads of flexbase for a driveway', at(0, 8, 15), at(0, 8, 15), { campaign: 'August Driveway Campaign', last_contact_at: null }),
    lead('qa-lead-spanish', 'qa-customer-rancho', 'ACTIVE', 'Website', 'Entrega de base para el camino del rancho', at(-1, 15), at(0, 9, 10)),
    lead('qa-lead-spanglish', 'qa-customer-kaufman-feed', 'ACTIVE', 'Walk in', 'Crushed concrete delivery behind the feed store', at(-3), at(-1), { human_takeover: true }),
    lead('qa-lead-escalation', 'qa-customer-natalie', 'ACTIVE', 'Website', 'Custom driveway repair and grading price', at(0, 8, 50), at(0, 9, 30)),
    lead('qa-lead-accepted', 'qa-customer-cedar', 'WON', 'Word of mouth', 'Regrade storage entrance and add flexbase', at(-8), at(-1)),
    lead('qa-lead-quote-followup', 'qa-customer-joe', 'QUOTED', 'Facebook', 'Crushed concrete for shop entrance', at(-8), at(-4)),
  ]

  const messages: LeadMessage[] = [
    message('qa-message-spanish-1', 'qa-lead-spanish', 'qa-customer-rancho', 'CUSTOMER', 'hola, necesito base para el camino. hacen entrega?', at(-1, 15, 5)),
    message('qa-message-spanish-2', 'qa-lead-spanish', 'qa-customer-rancho', 'AI', 'sí, entregamos. me comparte la dirección y cuántas cargas necesita?', at(-1, 15, 7)),
    message('qa-message-spanish-3', 'qa-lead-spanish', 'qa-customer-rancho', 'CUSTOMER', 'son dos cargas cerca de crandall', at(0, 9, 10)),
    message('qa-message-spanglish-1', 'qa-lead-spanglish', 'qa-customer-kaufman-feed', 'CUSTOMER', 'need one load mañana, atrás del feed store', at(-3, 10)),
    message('qa-message-spanglish-2', 'qa-lead-spanglish', 'qa-customer-kaufman-feed', 'AI', 'sí, one load tomorrow. what time can the truck clear the dock?', at(-3, 10, 3)),
    message('qa-message-spanglish-3', 'qa-lead-spanglish', 'qa-customer-kaufman-feed', 'HUMAN', 'after 5 works. i will put it on the calendar', at(-3, 10, 8)),
    message('qa-message-escalation-1', 'qa-lead-escalation', 'qa-customer-natalie', 'CUSTOMER', 'Can you give me one total price to fix the driveway and reshape the ditch?', at(0, 8, 50)),
    message('qa-message-escalation-2', 'qa-lead-escalation', 'qa-customer-natalie', 'AI', 'i can help collect the details, but Salvador needs to price custom driveway work.', at(0, 9, 28)),
    message('qa-message-escalation-3', 'qa-lead-escalation', 'qa-customer-natalie', 'SYSTEM', 'Salvador needed for custom driveway pricing.', at(0, 9, 30)),
    message('qa-message-quote-spouse', 'qa-lead-quote-followup', 'qa-customer-joe', 'CUSTOMER', 'thanks, i need to talk to my wife about the quote', at(-4, 14)),
  ]

  const quotes: Quote[] = [
    quote('qa-quote-accepted', 'Q1108', 'qa-customer-cedar', 'qa-lead-accepted', 'ACCEPTED', 'Regrade entrance and install flexbase', 4200, at(-1), { address: '1120 County Road 213, Kemp' }),
    quote('qa-quote-followup', 'Q1109', 'qa-customer-joe', 'qa-lead-quote-followup', 'SENT', 'Crushed concrete for shop entrance', 1790, at(-4), { address: '8850 FM 987, Terrell', sent_at: at(-4) }),
  ]

  const quoteItems: QuoteItem[] = [
    { id: 'qa-quote-item-accepted', quote_id: 'qa-quote-accepted', kind: 'CUSTOM_WORK', material_id: null, description: 'Regrade and install entrance', loads: null, yards: null, is_full_load: false, rate_used: 4200, line_total: 4200, created_at: at(-1) },
    { id: 'qa-quote-item-followup', quote_id: 'qa-quote-followup', kind: 'MATERIAL', material_id: 'qa-material-crushed', description: 'Commercial Crushed Concrete Clean', loads: 4, yards: 80, is_full_load: true, rate_used: 350, line_total: 1400, created_at: at(-4) },
  ]

  const jobs: Job[] = [
    job('qa-job-ortiz', 'qa-customer-ortiz', 'DRIVEWAY', 'SCHEDULED', day(0), 'Driveway base delivery', '4412 County Road 317, Kaufman', 3420.7, at(-6), { blocked_reason: 'Missing gate code', blocked_at: at(0, 7, 5), scheduled_time: '07:30:00' }),
    job('qa-job-material-today', 'qa-customer-lopez', 'MATERIAL_DELIVERY', 'SCHEDULED', day(0), 'Two loads of crushed concrete', '1700 SH 34, Terrell', 970, at(-3), { scheduled_time: '10:30:00' }),
    job('qa-job-tomorrow', 'qa-customer-marisol', 'MATERIAL_DELIVERY', 'SCHEDULED', day(1), 'Flexbase delivery', '908 E Fair Street, Kaufman', 1688.7, at(-2), { scheduled_time: '09:00:00' }),
    job('qa-job-complete-no-invoice', 'qa-customer-ellis', 'DIRT_GRADING', 'COMPLETED', day(-1), 'Grade equipment pad', '225 Industrial Way, Forney', 2800, at(-1), { completed_at: at(-1, 16) }),
    job('qa-job-kaufman-history', 'qa-customer-kaufman-feed', 'MATERIAL_DELIVERY', 'COMPLETED', day(-12), 'Crushed concrete behind feed store', '400 S Washington, Kaufman', 970, at(-12), { completed_at: at(-12, 18) }),
    job('qa-job-review', 'qa-customer-review', 'DRIVEWAY', 'COMPLETED', day(-3), 'Fresh gravel driveway surface', '311 Meadow Lane, Crandall', 2400, at(-3), { completed_at: at(-3, 17) }),
    job('qa-job-reactivation', 'qa-customer-reactivation', 'POND', 'COMPLETED', day(-70), 'Repair pond overflow', '7800 FM 1392, Scurry', 5200, at(-70), { completed_at: at(-70, 16) }),
    job('qa-job-dwayne', 'qa-customer-dwayne', 'DRIVEWAY', 'COMPLETED', day(-9), 'Driveway apron repair', '1811 Oak Trail, Mabank', 640, at(-9), { completed_at: at(-9, 15) }),
  ]

  const materials = [
    { id: 'qa-material-crushed', name: 'Commercial Crushed Concrete Clean', price_per_yard: 20, full_load_price: 350, full_load_yards: 20, is_active: true, sort_order: 1, created_at: at(-500), updated_at: at(-30) },
    { id: 'qa-material-cushion', name: 'Select Fill and Cushion Sand', price_per_yard: 20, full_load_price: 350, full_load_yards: 20, is_active: true, sort_order: 2, created_at: at(-500), updated_at: at(-30) },
    { id: QA_MISSING_DELIVERY_MATERIAL_ID, name: 'Flexbase First Class 1" or 3"', price_per_yard: 38, full_load_price: 720, full_load_yards: 20, is_active: true, sort_order: 3, created_at: at(-500), updated_at: at(-30) },
    { id: 'qa-material-mason', name: 'Mason Sand', price_per_yard: 45, full_load_price: 820, full_load_yards: 20, is_active: true, sort_order: 4, created_at: at(-500), updated_at: at(-30) },
    { id: 'qa-material-gravel', name: 'Native Gravel 3/8"-1"', price_per_yard: 53, full_load_price: 980, full_load_yards: 20, is_active: true, sort_order: 5, created_at: at(-500), updated_at: at(-30) },
  ]

  const tickets: ControlData['tickets'] = [
    { id: 'qa-ticket-mixed', ticket_number: 'MT1108', client_request_id: '10000000-0000-4000-8000-000000000108', customer_id: 'qa-customer-kaufman-feed', job_id: 'qa-job-kaufman-history', customer_name: 'Kaufman Feed', customer_phone: '(972) 555-0119', job_site_address: '400 S Washington, Kaufman', driver_id: 'qa-driver-salvador', delivery_type: 'tier_2', delivery_miles: null, delivery_fee_per_load: 60, load_count: 5, delivery_total: 300, materials_subtotal: 2860, tax_rate: 0.0825, tax_applies_to_delivery: true, tax_amount: 260.7, grand_total: 3420.7, notes: '3 Flexbase loads and 2 Crushed Concrete loads.', payment_status: 'paid', status: 'saved', printed_at: at(-12, 19), voided_at: null, void_reason: null, voided_by: null, created_by: QA_FIXTURE_USER_ID, created_at: at(-12, 17), updated_at: at(-12, 19) },
    { id: 'qa-ticket-standalone', ticket_number: 'MT1109', client_request_id: '10000000-0000-4000-8000-000000000109', customer_id: QA_MISSING_DELIVERY_CUSTOMER_ID, job_id: null, customer_name: 'Arturo Martinez', customer_phone: '(972) 555-0182', job_site_address: '2290 County Road 4104, Kaufman', driver_id: 'qa-driver-salvador', delivery_type: 'tier_2', delivery_miles: null, delivery_fee_per_load: 60, load_count: 1, delivery_total: 60, materials_subtotal: 720, tax_rate: 0.0825, tax_applies_to_delivery: true, tax_amount: 64.35, grand_total: 844.35, notes: 'Standalone direct material order.', payment_status: 'unpaid', status: 'saved', printed_at: null, voided_at: null, void_reason: null, voided_by: null, created_by: QA_FIXTURE_USER_ID, created_at: at(-4), updated_at: at(-4) },
    { id: 'qa-ticket-offline', ticket_number: '', client_request_id: '10000000-0000-4000-8000-000000000110', customer_id: 'qa-customer-lopez', job_id: 'qa-job-material-today', customer_name: 'Lopez Materials', customer_phone: '(469) 555-0160', job_site_address: '1700 SH 34, Terrell', driver_id: 'qa-driver-salvador', delivery_type: 'tier_3', delivery_miles: null, delivery_fee_per_load: 100, load_count: 1, delivery_total: 100, materials_subtotal: 350, tax_rate: 0.0825, tax_applies_to_delivery: true, tax_amount: 37.13, grand_total: 487.13, notes: 'Offline QA ticket waiting to sync.', payment_status: 'unpaid', status: 'pending', printed_at: null, voided_at: null, void_reason: null, voided_by: null, created_by: QA_FIXTURE_USER_ID, created_at: at(0, 6, 45), updated_at: at(0, 6, 45) },
    { id: 'qa-ticket-void', ticket_number: 'MT1107', client_request_id: '10000000-0000-4000-8000-000000000107', customer_id: 'qa-customer-riverbend', job_id: null, customer_name: 'Riverbend Estates', customer_phone: '(469) 555-0190', job_site_address: '501 River Bend Road, Terrell', driver_id: 'qa-driver-salvador', delivery_type: 'tier_2', delivery_miles: null, delivery_fee_per_load: 60, load_count: 1, delivery_total: 60, materials_subtotal: 350, tax_rate: 0.0825, tax_applies_to_delivery: true, tax_amount: 33.83, grand_total: 443.83, notes: null, payment_status: 'unpaid', status: 'void', printed_at: null, voided_at: at(-6), void_reason: 'Customer cancelled before material left the yard', voided_by: QA_FIXTURE_USER_ID, created_by: QA_FIXTURE_USER_ID, created_at: at(-7), updated_at: at(-6) },
  ]

  const ticketItems: ControlData['ticketItems'] = [
    { id: 'qa-ticket-item-flex-3', ticket_id: 'qa-ticket-mixed', material_id: QA_MISSING_DELIVERY_MATERIAL_ID, material_name: 'Flexbase First Class 1" or 3"', yards: 60, is_full_load: true, loads: 3, rate_used: 720, line_total: 2160, superseded_at: null, created_at: at(-12, 17) },
    { id: 'qa-ticket-item-crushed-2', ticket_id: 'qa-ticket-mixed', material_id: 'qa-material-crushed', material_name: 'Commercial Crushed Concrete Clean', yards: 40, is_full_load: true, loads: 2, rate_used: 350, line_total: 700, superseded_at: null, created_at: at(-12, 17) },
    { id: 'qa-ticket-item-standalone', ticket_id: 'qa-ticket-standalone', material_id: QA_MISSING_DELIVERY_MATERIAL_ID, material_name: 'Flexbase First Class 1" or 3"', yards: 20, is_full_load: true, loads: 1, rate_used: 720, line_total: 720, superseded_at: null, created_at: at(-4) },
    { id: 'qa-ticket-item-offline', ticket_id: 'qa-ticket-offline', material_id: 'qa-material-crushed', material_name: 'Commercial Crushed Concrete Clean', yards: 20, is_full_load: true, loads: 1, rate_used: 350, line_total: 350, superseded_at: null, created_at: at(0, 6, 45) },
    { id: 'qa-ticket-item-void', ticket_id: 'qa-ticket-void', material_id: 'qa-material-crushed', material_name: 'Commercial Crushed Concrete Clean', yards: 20, is_full_load: true, loads: 1, rate_used: 350, line_total: 350, superseded_at: null, created_at: at(-7) },
  ]

  const invoices: Invoice[] = [
    invoice('qa-invoice-due-soon', '1051', 'qa-customer-nina', 'SENT', 1480, 'Driveway material and delivery', at(-1), { due_at: at(2) }),
    invoice('qa-invoice-overdue', '1052', 'qa-customer-joe', 'SENT', 1790, 'Shop entrance material', at(-10), { due_at: at(-5) }),
    invoice('qa-invoice-dispute', '1053', 'qa-customer-riverbend', 'SENT', 2650, 'Drainage grading', at(-6), { due_at: at(-2), disputed: true, dispute_note: 'Customer says the final amount does not match the agreed work.' }),
    invoice('qa-invoice-zelle', '1054', 'qa-customer-dwayne', 'SENT', 640, 'Driveway apron repair', at(-9), { job_id: 'qa-job-dwayne', due_at: at(-6), payment_claimed_at: at(0, 8, 45), payment_claim_method: 'ZELLE', payment_claim_note: 'i sent the zelle yesterday' }),
    invoice('qa-invoice-kaufman-paid', '1048', 'qa-customer-kaufman-feed', 'PAID', 970, 'Crushed concrete delivery', at(-12), { job_id: 'qa-job-kaufman-history', paid_at: at(-10), due_at: at(-9) }),
    invoice('qa-invoice-review-paid', '1049', 'qa-customer-review', 'PAID', 2400, 'Fresh gravel driveway surface', at(-3), { job_id: 'qa-job-review', paid_at: at(-2), due_at: at(0) }),
    invoice('qa-invoice-reactivation-paid', '1002', 'qa-customer-reactivation', 'PAID', 5200, 'Pond overflow repair', at(-70), { job_id: 'qa-job-reactivation', paid_at: at(-65), due_at: at(-67) }),
  ]

  const payments: Payment[] = [
    payment('qa-payment-kaufman', 'qa-invoice-kaufman-paid', 'qa-customer-kaufman-feed', 970, 'CHECK', at(-10, 14)),
    payment('qa-payment-review', 'qa-invoice-review-paid', 'qa-customer-review', 2400, 'CARD', at(-2, 11)),
    payment('qa-payment-reactivation', 'qa-invoice-reactivation-paid', 'qa-customer-reactivation', 5200, 'ACH', at(-65, 10)),
  ]

  const workers: Worker[] = [
    worker('qa-worker-miguel', 'Miguel Santos', 'HOURLY', 22, false, at(-300)),
    worker('qa-worker-luis', 'Luis Ramirez', 'BY_LOAD', null, true, at(-240)),
    worker('qa-worker-salvador', 'Salvador Alvarez', 'BY_LOAD', null, true, at(-500)),
  ]

  const workerPayments: WorkerPayment[] = [
    workerPayment('qa-worker-pay-hourly', 'qa-worker-miguel', 'PENDING', 'MANUAL', 792, day(-8), day(-2), at(-1), { hours: 36, rate: 22 }),
    workerPayment('qa-worker-pay-driver', 'qa-worker-luis', 'PENDING', 'DRIVER_INVOICE', 1180, day(-8), day(-2), at(0, 6), { attachment_path: 'luis-driver-invoice-week-34.jpg' }),
    workerPayment('qa-worker-pay-paid', 'qa-worker-salvador', 'PAID', 'DRIVER_INVOICE', 1320, day(-15), day(-9), at(-8), { attachment_path: 'salvador-driver-invoice-week-33.jpg', paid_at: at(-7), confirmed_at: at(-8) }),
  ]

  const activities: Activity[] = [
    activity('qa-activity-ortiz-blocked', 'qa-customer-ortiz', 'JOB', 'qa-job-ortiz', 'BLOCKED', 'Job blocked: missing gate code', at(0, 7, 5), { body: 'The truck cannot enter until Salvador gets the current gate code.' }),
    activity('qa-activity-kaufman-ticket', 'qa-customer-kaufman-feed', 'TICKET', 'qa-ticket-mixed', 'CREATED', 'Ticket MT1108 created', at(-12, 17), { amount: 3420.7 }),
    activity('qa-activity-kaufman-job', 'qa-customer-kaufman-feed', 'JOB', 'qa-job-kaufman-history', 'COMPLETED', 'Crushed concrete delivery completed', at(-12, 18), { body: 'Five physical delivery loads completed.', photos: [deliveryPhoto, drivewayPhoto, regradePhoto] }),
    activity('qa-activity-kaufman-payment', 'qa-customer-kaufman-feed', 'PAYMENT', 'qa-payment-kaufman', 'RECORDED', 'Invoice 1048 paid', at(-10, 14), { amount: 970 }),
    activity('qa-activity-joe-followup-1', 'qa-customer-joe', 'INVOICE', 'qa-invoice-overdue', 'FOLLOW_UP', 'Reminder on the due date', at(-5)),
    activity('qa-activity-joe-followup-2', 'qa-customer-joe', 'INVOICE', 'qa-invoice-overdue', 'FOLLOW_UP', 'Reminder one day overdue', at(-4)),
    activity('qa-activity-joe-followup-3', 'qa-customer-joe', 'INVOICE', 'qa-invoice-overdue', 'FOLLOW_UP', 'Final automated reminder', at(-2)),
    activity('qa-activity-review-paid', 'qa-customer-review', 'PAYMENT', 'qa-payment-review', 'RECORDED', 'Invoice 1049 paid', at(-2, 11), { amount: 2400 }),
    activity('qa-activity-reactivation-paid', 'qa-customer-reactivation', 'PAYMENT', 'qa-payment-reactivation', 'RECORDED', 'Invoice 1002 paid', at(-65, 10), { amount: 5200 }),
    activity('qa-activity-ellis-complete', 'qa-customer-ellis', 'JOB', 'qa-job-complete-no-invoice', 'COMPLETED', 'Equipment pad grading completed', at(-1, 16)),
  ]

  const financialHistory: FinancialHistory[] = [
    { id: 'qa-financial-paid-kaufman', record_type: 'PAYMENT', record_id: 'qa-payment-kaufman', event_type: 'RECORDED', reason: 'Full outstanding balance recorded', before_snapshot: null, after_snapshot: { amount: 970 }, actor_id: QA_FIXTURE_USER_ID, actor_label: 'Salvador', created_at: at(-10, 14) },
    { id: 'qa-financial-paid-review', record_type: 'PAYMENT', record_id: 'qa-payment-review', event_type: 'RECORDED', reason: 'Full outstanding balance recorded', before_snapshot: null, after_snapshot: { amount: 2400 }, actor_id: QA_FIXTURE_USER_ID, actor_label: 'Salvador', created_at: at(-2, 11) },
    { id: 'qa-financial-worker-paid', record_type: 'WORKER_PAYMENT', record_id: 'qa-worker-pay-paid', event_type: 'PAID', reason: 'Salvador explicitly marked the worker paid', before_snapshot: null, after_snapshot: { amount: 1320 }, actor_id: QA_FIXTURE_USER_ID, actor_label: 'Salvador', created_at: at(-7) },
  ]

  const automations: AutomationRule[] = [
    { id: 'new-lead', name: 'New lead follow up', trigger_description: 'A lead is created', conditions: ['No opt out', 'No human takeover'], delay_description: 'Immediate, then business-hour follow ups', action_description: 'Ask only for the next missing detail', stop_conditions: ['Customer replies', 'Human takeover', 'Quote sent'], fallback_description: 'Delivery failure goes to Needs Attention', log_description: 'Lead conversation and customer history', status: 'SETUP_REQUIRED', updated_at: at(-1) },
    { id: 'human-takeover', name: 'Human takeover', trigger_description: 'Salvador replies', conditions: ['AI conversation is active'], delay_description: 'Immediate', action_description: 'Pause AI on that conversation', stop_conditions: [], fallback_description: 'Nothing is sent automatically', log_description: 'Conversation history', status: 'ON', updated_at: at(-1) },
    { id: 'job-reminder', name: 'Job reminder', trigger_description: 'A job is scheduled', conditions: ['Job active', 'More than 24 hours away'], delay_description: 'About 24 hours before work', action_description: 'Send date and time reminder', stop_conditions: ['Cancelled', 'Completed', 'Rescheduled'], fallback_description: 'Time changes go to Salvador', log_description: 'Job and customer history', status: 'SETUP_REQUIRED', updated_at: at(-1) },
    { id: 'invoice-follow-up', name: 'Invoice follow up', trigger_description: 'An invoice is sent', conditions: ['Invoice open', 'Not disputed'], delay_description: 'Due date and overdue sequence', action_description: 'Send a short reminder', stop_conditions: ['Payment recorded', 'Disputed', 'Voided'], fallback_description: 'Final failure goes to Needs Attention', log_description: 'Invoice and customer history', status: 'SETUP_REQUIRED', updated_at: at(-1) },
    { id: 'missed-call', name: 'Missed call recovery', trigger_description: 'A business call is missed', conditions: ['No active conversation'], delay_description: 'About 1 to 2 minutes', action_description: 'Offer to help by text', stop_conditions: ['Called back', 'Customer replied', 'Human takeover'], fallback_description: 'Failed delivery goes to Needs Attention', log_description: 'Customer history', status: 'SETUP_REQUIRED', updated_at: at(-1) },
    { id: 'quote-follow-up', name: 'Quote follow up', trigger_description: 'A quote is sent', conditions: ['Quote open', 'No complaint'], delay_description: 'Next business day, day 3 and day 7', action_description: 'Contextual quote follow up', stop_conditions: ['Reply', 'Accepted', 'Declined', 'Human takeover'], fallback_description: 'Negotiation goes to Salvador', log_description: 'Quote and customer history', status: 'SETUP_REQUIRED', updated_at: at(-1) },
    { id: 'review-request', name: 'Review request', trigger_description: 'Completed job and paid invoice', conditions: ['No complaint', 'Not already sent'], delay_description: 'About 24 hours after payment', action_description: 'Outcome appreciation then review request', stop_conditions: ['Problem reported', 'Already sent'], fallback_description: 'Problem goes to Salvador', log_description: 'Job and customer history', status: 'SETUP_REQUIRED', updated_at: at(-1) },
    { id: 'reactivation', name: '60 day reactivation', trigger_description: 'Completed and paid work reaches 60 days', conditions: ['No active work or money issue'], delay_description: 'Once around 60 days', action_description: 'Warm no pressure check in', stop_conditions: ['Customer returned', 'Already sent'], fallback_description: 'Reply opens a conversation', log_description: 'Customer history', status: 'SETUP_REQUIRED', updated_at: at(-1) },
  ]

  const trackingLinks: TrackingLink[] = [
    { id: 'qa-link-august', source: 'Facebook', campaign: 'August Driveway Campaign', destination: 'monkeytrucking.llc', slug: 'facebook-august-driveway', visits: 42, leads: 8, customers: 3, created_by: QA_FIXTURE_USER_ID, created_at: at(-20) },
  ]

  return {
    customers,
    leads,
    quotes,
    quoteItems,
    jobs,
    tickets,
    ticketItems,
    ticketHistory: [
      { id: 'qa-ticket-history-void', ticket_id: 'qa-ticket-void', event_type: 'voided', reason: 'Customer cancelled before material left the yard', before_snapshot: null, after_snapshot: null, actor_id: QA_FIXTURE_USER_ID, actor_label: 'Salvador', created_at: at(-6) },
    ],
    invoices,
    invoiceTickets: [
      { invoice_id: 'qa-invoice-kaufman-paid', ticket_id: 'qa-ticket-mixed', created_at: at(-12) },
    ],
    payments,
    workers,
    workerPayments,
    activities,
    messages,
    financialHistory,
    materials,
    drivers: [
      { id: 'qa-driver-salvador', name: 'Salvador Alvarez', is_active: true, created_at: at(-500), updated_at: at(-30) },
      { id: 'qa-driver-luis', name: 'Luis Ramirez', is_active: true, created_at: at(-240), updated_at: at(-30) },
    ],
    appSettings: {
      id: 1,
      company_name: 'Monkey Trucking LLC',
      company_phone: '(972) 555-0100',
      company_address: 'Kaufman County',
      company_city_state_zip: 'Kaufman, TX 75142',
      delivery_tier_1_fee: 0,
      delivery_tier_1_max_miles: 2,
      delivery_tier_2_fee: 60,
      delivery_tier_2_max_miles: 5,
      delivery_tier_3_fee: 100,
      delivery_tier_3_max_miles: 10,
      delivery_overage_base_fee: 100,
      delivery_overage_per_mile: 10,
      next_ticket_number: 1110,
      print_copies: 1,
      print_method: 'share',
      tax_applies_to_delivery: true,
      tax_rate: 0.0825,
      ticket_prefix: 'MT',
      updated_at: at(-1),
    },
    userRoles: [
      { id: 'qa-role-admin', user_id: QA_FIXTURE_USER_ID, role: 'admin', created_at: at(-500) },
    ],
    controlSettings: {
      id: 1,
      company_email: 'office@monkeytrucking.example',
      default_invoice_due_days: 3,
      custom_work_tax_rule: 'PENDING',
      review_url: null,
      business_number: null,
      sms_status: 'SETUP_REQUIRED',
      calling_status: 'SETUP_REQUIRED',
      ai_status: 'SETUP_REQUIRED',
      payment_processor_status: 'SETUP_REQUIRED',
      printable_logo_status: 'SETUP_REQUIRED',
      ai_english: true,
      ai_spanish: true,
      human_takeover_on_reply: true,
      updated_at: at(-1),
    },
    automations,
    trackingLinks,
    snoozes: [],
    aiConversationStates: [],
    aiAuditLogs: [],
    aiDrafts: [],
  }
}

export function fixtureSignature(data: ControlData) {
  return JSON.stringify({
    customers: data.customers.map((row) => [row.id, row.name, row.phone]),
    leads: data.leads.map((row) => [row.id, row.status, row.updated_at]),
    jobs: data.jobs.map((row) => [row.id, row.status, row.scheduled_date]),
    tickets: data.tickets.map((row) => [row.id, row.ticket_number, row.status, row.grand_total]),
    invoices: data.invoices.map((row) => [row.id, row.status, row.amount]),
    payments: data.payments.map((row) => [row.id, row.amount, row.received_at]),
    workerPayments: data.workerPayments.map((row) => [row.id, row.status, row.amount]),
  })
}

export function fixtureReferenceDate(reference = new Date()) {
  const value = new Date(reference)
  value.setHours(12, 0, 0, 0)
  return value.getTime()
}

export const QA_FIXTURE_DAY_MS = DAY
