import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  normalized_phone: string | null;
  email: string | null;
  normalized_email: string | null;
  notes: string | null;
  is_active: boolean;
  last_activity_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: string;
  customer_id: string;
  status: "NEW" | "ACTIVE" | "QUOTED" | "WON" | "LOST";
  source: "Word of mouth" | "Facebook" | "Website" | "Walk in" | "Other";
  campaign: string | null;
  need: string;
  human_takeover: boolean;
  last_contact_at: string | null;
  lost_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Quote = {
  id: string;
  quote_number: string;
  customer_id: string;
  lead_id: string | null;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "VOID";
  description: string;
  address: string;
  delivery_type: string | null;
  delivery_miles: number | null;
  delivery_fee_per_load: number;
  delivery_load_count: number;
  delivery_total: number;
  materials_subtotal: number;
  custom_work_subtotal: number;
  tax_rate: number;
  tax_applies_to_delivery: boolean;
  custom_work_tax_rule: "PENDING" | "TAXED" | "EXEMPT";
  tax_amount: number;
  grand_total: number;
  notes: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
  kind: "MATERIAL" | "CUSTOM_WORK";
  material_id: string | null;
  description: string;
  loads: number | null;
  yards: number | null;
  is_full_load: boolean;
  rate_used: number;
  line_total: number;
  created_at: string;
};

export type Job = {
  id: string;
  customer_id: string;
  quote_id: string | null;
  category: "MATERIAL_DELIVERY" | "DRIVEWAY" | "DIRT_GRADING" | "POND" | "DEMOLITION" | "OTHER";
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  scheduled_date: string;
  scheduled_time: string | null;
  all_day: boolean;
  address: string;
  description: string;
  agreed_amount: number;
  notes: string | null;
  blocked_reason: string | null;
  blocked_at: string | null;
  change_requested: boolean;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string;
  job_id: string | null;
  quote_id: string | null;
  standalone_ticket_id: string | null;
  amount_source: "JOB" | "QUOTE" | "TICKET";
  description: string;
  amount: number;
  status: "DRAFT" | "SENT" | "PAID" | "VOID";
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  disputed: boolean;
  dispute_note: string | null;
  payment_claimed_at: string | null;
  payment_claim_method: string | null;
  payment_claim_note: string | null;
  voided_at: string | null;
  void_reason: string | null;
  voided_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceTicket = { invoice_id: string; ticket_id: string; created_at: string };
export type Payment = {
  id: string;
  invoice_id: string;
  customer_id: string;
  amount: number;
  method: "ACH" | "CARD" | "ZELLE" | "APPLE_PAY" | "CHECK" | "OTHER";
  confirmed_by: "HUMAN" | "PROCESSOR";
  note: string | null;
  received_at: string;
  recorded_by: string | null;
  recorded_at: string;
  voided_at: string | null;
  void_reason: string | null;
  voided_by: string | null;
};

export type Worker = {
  id: string;
  name: string;
  pay_type: "HOURLY" | "BY_LOAD";
  hourly_rate: number | null;
  is_driver: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkerPayment = {
  id: string;
  worker_id: string;
  period_start: string;
  period_end: string;
  hours: number | null;
  rate: number | null;
  amount: number;
  status: "PENDING" | "CONFIRMED" | "PAID" | "VOID";
  source: "MANUAL" | "DRIVER_INVOICE";
  attachment_path: string | null;
  confirmed_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  voided_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  customer_id: string | null;
  entity_type: string;
  entity_id: string | null;
  event_type: string;
  summary: string;
  metadata: Json;
  actor_id: string | null;
  actor_label: string | null;
  created_at: string;
};

export type LeadMessage = {
  id: string;
  lead_id: string;
  customer_id: string;
  sender_type: "CUSTOMER" | "AI" | "HUMAN" | "SYSTEM";
  body: string;
  delivery_status: "INTERNAL" | "PENDING" | "SENT" | "DELIVERED" | "FAILED";
  provider_message_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type ControlSettings = {
  id: number;
  company_email: string | null;
  default_invoice_due_days: number;
  custom_work_tax_rule: "PENDING" | "TAXED" | "EXEMPT";
  review_url: string | null;
  business_number: string | null;
  sms_status: "READY" | "SETUP_REQUIRED" | "OFF";
  calling_status: "READY" | "SETUP_REQUIRED" | "OFF";
  ai_status: "READY" | "SETUP_REQUIRED" | "OFF";
  payment_processor_status: "READY" | "SETUP_REQUIRED" | "OFF";
  printable_logo_status: "READY" | "SETUP_REQUIRED";
  updated_at: string;
};

export type AutomationRule = {
  id: string;
  name: string;
  trigger_description: string;
  conditions: Json;
  delay_description: string;
  action_description: string;
  stop_conditions: Json;
  fallback_description: string;
  log_description: string;
  status: "ON" | "SETUP_REQUIRED" | "OFF";
  updated_at: string;
};

export type TrackingLink = {
  id: string;
  source: "Facebook" | "Website" | "QR code" | "Other";
  campaign: string;
  destination: string;
  slug: string;
  visits: number;
  leads: number;
  customers: number;
  created_by: string | null;
  created_at: string;
};

export type AttentionSnooze = {
  id: string;
  user_id: string;
  fingerprint: string;
  returns_at: string;
  created_at: string;
};

type ControlDatabase = {
  public: {
    Tables: {
      customers: Table<Customer>;
      leads: Table<Lead>;
      quotes: Table<Quote>;
      quote_items: Table<QuoteItem>;
      jobs: Table<Job>;
      invoices: Table<Invoice>;
      invoice_tickets: Table<InvoiceTicket>;
      payments: Table<Payment>;
      workers: Table<Worker>;
      worker_payments: Table<WorkerPayment>;
      activity_history: Table<Activity>;
      lead_messages: Table<LeadMessage>;
      control_center_settings: Table<ControlSettings>;
      automation_rules: Table<AutomationRule>;
      tracking_links: Table<TrackingLink>;
      attention_snoozes: Table<AttentionSnooze>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export const controlDb = supabase as unknown as SupabaseClient<ControlDatabase>;
export type Ticket = Tables<"tickets">;
export type TicketItem = Tables<"ticket_items">;
export type TicketHistory = Tables<"ticket_history">;
export type Material = Tables<"materials">;
export type Driver = Tables<"drivers">;
export type AppSettings = Tables<"app_settings">;
export type UserRole = Tables<"user_roles">;

export type ControlData = {
  customers: Customer[];
  leads: Lead[];
  quotes: Quote[];
  quoteItems: QuoteItem[];
  jobs: Job[];
  tickets: Ticket[];
  ticketItems: TicketItem[];
  ticketHistory: TicketHistory[];
  invoices: Invoice[];
  invoiceTickets: InvoiceTicket[];
  payments: Payment[];
  workers: Worker[];
  workerPayments: WorkerPayment[];
  activities: Activity[];
  messages: LeadMessage[];
  materials: Material[];
  drivers: Driver[];
  appSettings: AppSettings | null;
  userRoles: UserRole[];
  controlSettings: ControlSettings | null;
  automations: AutomationRule[];
  trackingLinks: TrackingLink[];
  snoozes: AttentionSnooze[];
};

const unwrap = <T,>(result: { data: T | null; error: { message: string; code?: string } | null }, label: string): T => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data as T;
};

export async function loadControlData(): Promise<ControlData> {
  const [
    customers, leads, quotes, quoteItems, jobs, tickets, ticketItems, ticketHistory, invoices,
    invoiceTickets, payments, workers, workerPayments, activities, messages,
    materials, drivers, appSettings, userRoles, controlSettings, automations, trackingLinks, snoozes,
  ] = await Promise.all([
    controlDb.from("customers").select("*").order("last_activity_at", { ascending: false }),
    controlDb.from("leads").select("*").order("created_at", { ascending: false }),
    controlDb.from("quotes").select("*").order("created_at", { ascending: false }),
    controlDb.from("quote_items").select("*").order("created_at"),
    controlDb.from("jobs").select("*").order("scheduled_date"),
    supabase.from("tickets").select("*").order("created_at", { ascending: false }),
    supabase.from("ticket_items").select("*").is("superseded_at", null).order("created_at"),
    supabase.from("ticket_history").select("*").order("created_at", { ascending: false }).limit(1000),
    controlDb.from("invoices").select("*").order("created_at", { ascending: false }),
    controlDb.from("invoice_tickets").select("*"),
    controlDb.from("payments").select("*").order("received_at", { ascending: false }),
    controlDb.from("workers").select("*").order("name"),
    controlDb.from("worker_payments").select("*").order("created_at", { ascending: false }),
    controlDb.from("activity_history").select("*").order("created_at", { ascending: false }).limit(500),
    controlDb.from("lead_messages").select("*").order("created_at"),
    supabase.from("materials").select("*").order("sort_order"),
    supabase.from("drivers").select("*").order("name"),
    supabase.from("app_settings").select("*").limit(1).maybeSingle(),
    supabase.from("user_roles").select("*").order("created_at"),
    controlDb.from("control_center_settings").select("*").eq("id", 1).maybeSingle(),
    controlDb.from("automation_rules").select("*").order("name"),
    controlDb.from("tracking_links").select("*").order("created_at", { ascending: false }),
    controlDb.from("attention_snoozes").select("*"),
  ]);

  return {
    customers: unwrap(customers, "Customers") ?? [],
    leads: unwrap(leads, "Leads") ?? [],
    quotes: unwrap(quotes, "Quotes") ?? [],
    quoteItems: unwrap(quoteItems, "Quote items") ?? [],
    jobs: unwrap(jobs, "Jobs") ?? [],
    tickets: unwrap(tickets, "Tickets") ?? [],
    ticketItems: unwrap(ticketItems, "Ticket items") ?? [],
    ticketHistory: unwrap(ticketHistory, "Ticket history") ?? [],
    invoices: unwrap(invoices, "Invoices") ?? [],
    invoiceTickets: unwrap(invoiceTickets, "Invoice tickets") ?? [],
    payments: unwrap(payments, "Payments") ?? [],
    workers: unwrap(workers, "Workers") ?? [],
    workerPayments: unwrap(workerPayments, "Worker payments") ?? [],
    activities: unwrap(activities, "Activity history") ?? [],
    messages: unwrap(messages, "Messages") ?? [],
    materials: unwrap(materials, "Materials") ?? [],
    drivers: unwrap(drivers, "Drivers") ?? [],
    appSettings: unwrap(appSettings, "Business settings") as AppSettings | null,
    userRoles: unwrap(userRoles, "User roles") ?? [],
    controlSettings: unwrap(controlSettings, "Control Center settings"),
    automations: unwrap(automations, "Automation rules") ?? [],
    trackingLinks: unwrap(trackingLinks, "Tracking links") ?? [],
    snoozes: unwrap(snoozes, "Attention snoozes") ?? [],
  };
}

type RpcResult<T> = { data: T; error: { message: string } | null };
const rpc = supabase.rpc.bind(supabase) as unknown as (
  functionName: string,
  args?: Record<string, unknown>,
) => PromiseLike<RpcResult<unknown>>;

async function runRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type NewLeadInput = {
  name: string;
  phone: string;
  email?: string;
  source: Lead["source"];
  campaign?: string;
  need: string;
};

export const createLead = (input: NewLeadInput) => runRpc<Array<{
  lead_id: string;
  customer_id: string;
  matched_existing: boolean;
}>>("create_lead_with_customer", {
  p_name: input.name,
  p_phone: input.phone,
  p_email: input.email ?? "",
  p_source: input.source,
  p_campaign: input.campaign ?? "",
  p_need: input.need,
});

export type NewJobInput = {
  customerId?: string;
  name?: string;
  phone?: string;
  email?: string;
  quoteId?: string;
  category: Job["category"];
  date: string;
  time?: string;
  allDay: boolean;
  address: string;
  description: string;
  agreedAmount: number;
  notes?: string;
};

export const createJob = (input: NewJobInput) => runRpc<string>("create_job_with_customer", {
  p_name: input.name ?? "",
  p_phone: input.phone ?? "",
  p_email: input.email ?? "",
  p_customer_id: input.customerId ?? null,
  p_quote_id: input.quoteId ?? null,
  p_category: input.category,
  p_date: input.date,
  p_time: input.time ?? null,
  p_all_day: input.allDay,
  p_address: input.address,
  p_description: input.description,
  p_agreed_amount: input.agreedAmount,
  p_notes: input.notes ?? "",
});

export type QuoteDraft = {
  customerId: string;
  leadId?: string;
  description: string;
  address: string;
  deliveryType: string;
  deliveryMiles?: number;
  deliveryFeePerLoad: number;
  deliveryLoadCount: number;
  deliveryTotal: number;
  materialsSubtotal: number;
  customWorkSubtotal: number;
  taxRate: number;
  taxOnDelivery: boolean;
  customWorkTaxRule: Quote["custom_work_tax_rule"];
  taxAmount: number;
  grandTotal: number;
  notes?: string;
  items: Array<{
    kind: "MATERIAL" | "CUSTOM_WORK";
    materialId?: string;
    description: string;
    loads?: number;
    yards?: number;
    isFullLoad: boolean;
    rateUsed: number;
    lineTotal: number;
  }>;
};

export const saveQuote = (draft: QuoteDraft) => runRpc<Array<{ id: string; quote_number: string }>>(
  "save_quote_atomic",
  {
    p_quote: {
      customer_id: draft.customerId,
      lead_id: draft.leadId ?? "",
      status: "DRAFT",
      description: draft.description,
      address: draft.address,
      delivery_type: draft.deliveryType,
      delivery_miles: draft.deliveryMiles ?? "",
      delivery_fee_per_load: draft.deliveryFeePerLoad,
      delivery_load_count: draft.deliveryLoadCount,
      delivery_total: draft.deliveryTotal,
      materials_subtotal: draft.materialsSubtotal,
      custom_work_subtotal: draft.customWorkSubtotal,
      tax_rate: draft.taxRate,
      tax_applies_to_delivery: draft.taxOnDelivery,
      custom_work_tax_rule: draft.customWorkTaxRule,
      tax_amount: draft.taxAmount,
      grand_total: draft.grandTotal,
      notes: draft.notes ?? "",
    },
    p_items: draft.items.map((item) => ({
      kind: item.kind,
      material_id: item.materialId ?? "",
      description: item.description,
      loads: item.loads ?? "",
      yards: item.yards ?? "",
      is_full_load: item.isFullLoad,
      rate_used: item.rateUsed,
      line_total: item.lineTotal,
    })),
  },
);

export const updateLead = async (id: string, values: Partial<Lead>) => {
  const { error } = await controlDb.from("leads").update(values).eq("id", id);
  if (error) throw new Error(error.message);
  const lead = (await controlDb.from("leads").select("customer_id").eq("id", id).single()).data;
  if (lead) await controlDb.from("activity_history").insert({ customer_id: lead.customer_id, entity_type: "LEAD", entity_id: id, event_type: "UPDATED", summary: values.status ? `Lead moved to ${values.status}` : "Lead updated" });
};

export const updateQuote = async (id: string, values: Partial<Quote>) => {
  const { error } = await controlDb.from("quotes").update(values).eq("id", id);
  if (error) throw new Error(error.message);
  const quote = (await controlDb.from("quotes").select("customer_id, quote_number").eq("id", id).single()).data;
  if (quote) await controlDb.from("activity_history").insert({ customer_id: quote.customer_id, entity_type: "QUOTE", entity_id: id, event_type: "UPDATED", summary: values.status ? `Quote ${quote.quote_number} moved to ${values.status}` : `Quote ${quote.quote_number} updated` });
};

export const updateJob = async (id: string, values: Partial<Job>) => {
  const { error } = await controlDb.from("jobs").update(values).eq("id", id);
  if (error) throw new Error(error.message);
  const job = (await controlDb.from("jobs").select("customer_id").eq("id", id).single()).data;
  if (job) await controlDb.from("activity_history").insert({ customer_id: job.customer_id, entity_type: "JOB", entity_id: id, event_type: "UPDATED", summary: values.status ? `Job moved to ${values.status}` : "Job updated" });
};

export const updateInvoice = async (id: string, values: Partial<Invoice>) => {
  const { error } = await controlDb.from("invoices").update(values).eq("id", id);
  if (error) throw new Error(error.message);
};

export const createInvoiceFromJob = (jobId: string) =>
  runRpc<string>("create_invoice_from_job", { p_job_id: jobId });

export const createInvoiceFromTicket = (ticketId: string) =>
  runRpc<string>("create_invoice_from_standalone_ticket", { p_ticket_id: ticketId });

export const recordPayment = (invoiceId: string, method: Payment["method"], note: string) =>
  runRpc<string>("record_invoice_payment_full", {
    p_invoice_id: invoiceId,
    p_method: method,
    p_received_at: new Date().toISOString(),
    p_note: note,
  });

export const snoozeAttention = async (userId: string, fingerprint: string, returnsAt: string) => {
  const { error } = await controlDb.from("attention_snoozes").upsert({
    user_id: userId,
    fingerprint,
    returns_at: returnsAt,
  }, { onConflict: "user_id,fingerprint" });
  if (error) throw new Error(error.message);
};

export const saveControlSettings = async (values: Partial<ControlSettings>) => {
  const { error } = await controlDb.from("control_center_settings").update(values).eq("id", 1);
  if (error) throw new Error(error.message);
};

export const createWorker = async (input: { name: string; payType: Worker["pay_type"]; hourlyRate?: number; isDriver: boolean; notes?: string }) => {
  const { data, error } = await controlDb.from("workers").insert({
    name: input.name.trim(),
    pay_type: input.payType,
    hourly_rate: input.payType === "HOURLY" ? input.hourlyRate ?? null : null,
    is_driver: input.isDriver,
    notes: input.notes?.trim() || null,
    is_active: true,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
};

export const createTrackingLink = async (input: { source: TrackingLink["source"]; campaign: string; destination: string }) => {
  const baseSlug = input.campaign.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campaign";
  const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
  const { data, error } = await controlDb.from("tracking_links").insert({
    source: input.source,
    campaign: input.campaign.trim(),
    destination: input.destination.trim(),
    slug,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
};

export type NewWorkerPayment = {
  workerId: string;
  periodStart: string;
  periodEnd: string;
  hours?: number;
  rate?: number;
  amount: number;
  source: "MANUAL" | "DRIVER_INVOICE";
  attachmentPath?: string;
};

export const createWorkerPayment = (input: NewWorkerPayment) => runRpc<string>("create_worker_payment_pending", {
  p_worker_id: input.workerId,
  p_period_start: input.periodStart,
  p_period_end: input.periodEnd,
  p_hours: input.hours ?? null,
  p_rate: input.rate ?? null,
  p_amount: input.amount,
  p_source: input.source,
  p_attachment_path: input.attachmentPath ?? null,
});

export const confirmWorkerPayment = (id: string) => runRpc<void>("confirm_worker_payment_details", { p_worker_payment_id: id });
export const markWorkerPaymentPaid = (id: string) => runRpc<void>("mark_worker_payment_paid", { p_worker_payment_id: id });
export const voidFinancialRecord = (recordType: "INVOICE" | "PAYMENT" | "WORKER_PAYMENT", id: string, reason: string) =>
  runRpc<void>("void_financial_record", { p_record_type: recordType, p_record_id: id, p_reason: reason });

export function customerFor(data: ControlData, id: string | null | undefined) {
  return data.customers.find((customer) => customer.id === id);
}

export function invoiceStatus(invoice: Invoice): Invoice["status"] | "OVERDUE" {
  if (invoice.status === "SENT" && invoice.due_at && new Date(invoice.due_at).getTime() < Date.now()) return "OVERDUE";
  return invoice.status;
}

export function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  }).format(Number(value ?? 0));
}

export const dateLabel = (value: string | Date) => new Date(value).toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const dateKey = (value: Date = new Date()) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
