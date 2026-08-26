-- Phase 05 Control Center foundation.
-- This migration is forward only. It never rewrites legacy Ticket values, resets
-- the MT counter, or infers customer, job, tax, or item-load facts for old rows.

do $$
begin
  if to_regclass('public.user_roles') is null
    or to_regclass('public.tickets') is null
    or to_regclass('public.ticket_items') is null
    or (
      to_regprocedure('public.create_ticket_atomic(jsonb,jsonb,uuid,boolean)') is null
      and to_regprocedure('public.create_ticket_atomic(jsonb,jsonb,text,boolean)') is null
    ) then
    raise exception 'Apply and verify Phase 05 Ticket safety before the Control Center migration';
  end if;
end;
$$;

-- Lovable generated an additional Ticket migration with a user-id argument on
-- this helper. Keep that overload, and restore the approved no-argument helper
-- used by the Control Center. Both continue to read the same user_roles table.
create or replace function public.is_admin_or_staff()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role::text in ('admin','staff')
  );
$$;

create sequence if not exists public.quote_number_seq start with 1001;
create sequence if not exists public.invoice_number_seq start with 1001;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  normalized_phone text,
  email text,
  normalized_email text,
  notes text,
  is_active boolean not null default true,
  last_activity_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customers_normalized_phone_unique
  on public.customers (normalized_phone) where normalized_phone is not null;
create unique index if not exists customers_normalized_email_unique
  on public.customers (normalized_email) where normalized_email is not null;
create index if not exists customers_activity_idx on public.customers (last_activity_at desc);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  status text not null default 'NEW' check (status in ('NEW','ACTIVE','QUOTED','WON','LOST')),
  source text not null check (source in ('Word of mouth','Facebook','Website','Walk in','Other')),
  campaign text,
  need text not null check (length(trim(need)) > 0),
  human_takeover boolean not null default false,
  last_contact_at timestamptz,
  lost_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'LOST' or nullif(trim(lost_reason), '') is not null)
);
create index if not exists leads_customer_idx on public.leads (customer_id, created_at desc);
create index if not exists leads_status_idx on public.leads (status, updated_at desc);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete restrict,
  status text not null default 'DRAFT' check (status in ('DRAFT','SENT','ACCEPTED','DECLINED','VOID')),
  description text not null default '',
  address text not null default '',
  delivery_type text,
  delivery_miles numeric,
  delivery_fee_per_load numeric not null default 0 check (delivery_fee_per_load >= 0),
  delivery_load_count integer not null default 1 check (delivery_load_count > 0),
  delivery_total numeric not null default 0 check (delivery_total >= 0),
  materials_subtotal numeric not null default 0 check (materials_subtotal >= 0),
  custom_work_subtotal numeric not null default 0 check (custom_work_subtotal >= 0),
  tax_rate numeric not null default 0 check (tax_rate >= 0),
  tax_applies_to_delivery boolean not null default true,
  custom_work_tax_rule text not null default 'PENDING' check (custom_work_tax_rule in ('PENDING','TAXED','EXEMPT')),
  tax_amount numeric not null default 0 check (tax_amount >= 0),
  grand_total numeric not null default 0 check (grand_total >= 0),
  notes text,
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'VOID' or nullif(trim(void_reason), '') is not null)
);
alter table public.quotes add column if not exists address text not null default '';
create index if not exists quotes_customer_idx on public.quotes (customer_id, created_at desc);
create index if not exists quotes_lead_idx on public.quotes (lead_id);
create index if not exists quotes_status_idx on public.quotes (status, updated_at desc);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete restrict,
  kind text not null check (kind in ('MATERIAL','CUSTOM_WORK')),
  material_id uuid references public.materials(id) on delete restrict,
  description text not null,
  loads integer check (loads is null or loads > 0),
  yards numeric check (yards is null or yards > 0),
  is_full_load boolean not null default false,
  rate_used numeric not null default 0 check (rate_used >= 0),
  line_total numeric not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index if not exists quote_items_quote_idx on public.quote_items (quote_id, created_at);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  quote_id uuid unique references public.quotes(id) on delete restrict,
  category text not null check (category in ('MATERIAL_DELIVERY','DRIVEWAY','DIRT_GRADING','POND','DEMOLITION','OTHER')),
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')),
  scheduled_date date not null,
  scheduled_time time,
  all_day boolean not null default false,
  address text not null,
  description text not null,
  agreed_amount numeric not null default 0 check (agreed_amount >= 0),
  notes text,
  blocked_reason text,
  blocked_at timestamptz,
  change_requested boolean not null default false,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'CANCELLED' or nullif(trim(cancellation_reason), '') is not null)
);
create index if not exists jobs_calendar_idx on public.jobs (scheduled_date, scheduled_time)
  where status <> 'CANCELLED';
create index if not exists jobs_customer_idx on public.jobs (customer_id, created_at desc);

alter table public.tickets add column if not exists customer_id uuid references public.customers(id) on delete restrict;
alter table public.tickets add column if not exists job_id uuid references public.jobs(id) on delete restrict;
create index if not exists tickets_customer_idx on public.tickets (customer_id, created_at desc);
create index if not exists tickets_job_idx on public.tickets (job_id, created_at desc);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete restrict,
  quote_id uuid references public.quotes(id) on delete restrict,
  standalone_ticket_id uuid references public.tickets(id) on delete restrict,
  amount_source text not null check (amount_source in ('JOB','QUOTE','TICKET')),
  description text not null,
  amount numeric not null check (amount >= 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','SENT','PAID','VOID')),
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  disputed boolean not null default false,
  dispute_note text,
  payment_claimed_at timestamptz,
  payment_claim_method text,
  payment_claim_note text,
  voided_at timestamptz,
  void_reason text,
  voided_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'VOID' or nullif(trim(void_reason), '') is not null)
);
create unique index if not exists invoices_one_per_job on public.invoices (job_id)
  where job_id is not null and status <> 'VOID';
create unique index if not exists invoices_one_per_standalone_ticket
  on public.invoices (standalone_ticket_id)
  where standalone_ticket_id is not null and status <> 'VOID';
create index if not exists invoices_customer_idx on public.invoices (customer_id, created_at desc);
create index if not exists invoices_due_idx on public.invoices (due_at) where status = 'SENT';

create table if not exists public.invoice_tickets (
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  ticket_id uuid not null references public.tickets(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (invoice_id, ticket_id)
);
create index if not exists invoice_tickets_ticket_idx on public.invoice_tickets (ticket_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  amount numeric not null check (amount > 0),
  method text not null check (method in ('ACH','CARD','ZELLE','APPLE_PAY','CHECK','OTHER')),
  confirmed_by text not null check (confirmed_by in ('HUMAN','PROCESSOR')),
  note text,
  received_at timestamptz not null,
  recorded_by uuid default auth.uid(),
  recorded_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text,
  voided_by uuid,
  check (voided_at is null or nullif(trim(void_reason), '') is not null)
);
create index if not exists payments_invoice_idx on public.payments (invoice_id, received_at);
create index if not exists payments_received_idx on public.payments (received_at)
  where voided_at is null;

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pay_type text not null check (pay_type in ('HOURLY','BY_LOAD')),
  hourly_rate numeric,
  is_driver boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worker_payments (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  hours numeric,
  rate numeric,
  amount numeric not null check (amount >= 0),
  status text not null default 'PENDING' check (status in ('PENDING','CONFIRMED','PAID','VOID')),
  source text not null check (source in ('MANUAL','DRIVER_INVOICE')),
  attachment_path text,
  confirmed_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  voided_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (status <> 'VOID' or nullif(trim(void_reason), '') is not null)
);

create table if not exists public.activity_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete restrict,
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid default auth.uid(),
  actor_label text,
  created_at timestamptz not null default now()
);
create index if not exists activity_customer_idx on public.activity_history (customer_id, created_at desc);
create index if not exists activity_entity_idx on public.activity_history (entity_type, entity_id, created_at desc);

create table if not exists public.financial_history (
  id uuid primary key default gen_random_uuid(),
  record_type text not null check (record_type in ('INVOICE','PAYMENT','WORKER_PAYMENT')),
  record_id uuid not null,
  event_type text not null,
  reason text not null,
  before_snapshot jsonb,
  after_snapshot jsonb,
  actor_id uuid default auth.uid(),
  actor_label text,
  created_at timestamptz not null default now()
);
create index if not exists financial_history_record_idx
  on public.financial_history (record_type, record_id, created_at desc);

create table if not exists public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  sender_type text not null check (sender_type in ('CUSTOMER','AI','HUMAN','SYSTEM')),
  body text not null,
  delivery_status text not null default 'INTERNAL' check (delivery_status in ('INTERNAL','PENDING','SENT','DELIVERED','FAILED')),
  provider_message_id text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists lead_messages_lead_idx on public.lead_messages (lead_id, created_at);

create table if not exists public.attention_snoozes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  fingerprint text not null,
  returns_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

create table if not exists public.control_center_settings (
  id integer primary key default 1 check (id = 1),
  company_email text,
  default_invoice_due_days integer not null default 3 check (default_invoice_due_days > 0),
  custom_work_tax_rule text not null default 'PENDING' check (custom_work_tax_rule in ('PENDING','TAXED','EXEMPT')),
  review_url text,
  business_number text,
  sms_status text not null default 'SETUP_REQUIRED' check (sms_status in ('READY','SETUP_REQUIRED','OFF')),
  calling_status text not null default 'SETUP_REQUIRED' check (calling_status in ('READY','SETUP_REQUIRED','OFF')),
  ai_status text not null default 'SETUP_REQUIRED' check (ai_status in ('READY','SETUP_REQUIRED','OFF')),
  payment_processor_status text not null default 'SETUP_REQUIRED' check (payment_processor_status in ('READY','SETUP_REQUIRED','OFF')),
  printable_logo_status text not null default 'SETUP_REQUIRED' check (printable_logo_status in ('READY','SETUP_REQUIRED')),
  updated_at timestamptz not null default now()
);
insert into public.control_center_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.automation_rules (
  id text primary key,
  name text not null,
  trigger_description text not null,
  conditions jsonb not null default '[]'::jsonb,
  delay_description text not null,
  action_description text not null,
  stop_conditions jsonb not null default '[]'::jsonb,
  fallback_description text not null,
  log_description text not null,
  status text not null default 'SETUP_REQUIRED' check (status in ('ON','SETUP_REQUIRED','OFF')),
  updated_at timestamptz not null default now()
);

insert into public.automation_rules (
  id, name, trigger_description, conditions, delay_description, action_description,
  stop_conditions, fallback_description, log_description, status
) values
  ('new-lead','New lead follow up','A lead is created','["Customer has not opted out","No human takeover"]','Immediate, about 4 business hours, next business day, then about 3 days','Ask only for the next missing piece of information','["Customer replies","Human takeover","Quote sent","Lead won","Lead lost","Opt out"]','Delivery failure or AI uncertainty goes to Needs Attention','Lead conversation and customer history','SETUP_REQUIRED'),
  ('missed-call','Missed call recovery','A business call is missed','["No active conversation"]','About 1 to 2 minutes','Send one short recovery text','["Customer calls back","Customer replies","Human takeover"]','Create a call-back attention item if delivery fails','Customer history','SETUP_REQUIRED'),
  ('quote-follow-up','Quote follow up','A quote is sent','["Quote remains open","No unresolved complaint","No opt out"]','Next business day, about 3 days, then about 7 days','Send a contextual quote follow up','["Reply","Accepted","Declined","Human takeover","Lead lost","Opt out"]','Negotiation goes to Salvador','Quote and customer history','SETUP_REQUIRED'),
  ('human-takeover','Human takeover','A human replies in an AI conversation','["AI conversation is active"]','Immediate','Pause AI on that conversation','[]','Approved later workflows may become eligible again','Conversation history','ON'),
  ('job-reminder','Job reminder','A job is scheduled','["Job is active","Scheduled more than 24 hours ahead"]','About 24 hours before work','Send one date and time reminder','["Cancelled","Completed","Rescheduled"]','Time change request goes to Salvador','Job and customer history','SETUP_REQUIRED'),
  ('invoice-follow-up','Invoice follow up','An invoice is sent','["Invoice open","Not disputed","No opt out"]','Due date, about 1 day overdue, then about 3 days overdue','Send a short amount and due-date reminder','["Payment recorded","Voided","Disputed","Due date changed","Human takeover","Opt out"]','After final reminder create Needs Attention; payment claims never mark paid','Invoice and customer history','SETUP_REQUIRED'),
  ('review-request','Review request','A job is complete and its invoice is paid','["No complaint","No dispute","Not already sent","No opt out"]','About 24 hours after payment','Send one warm outcome-specific review request','["Problem reported","Already sent"]','Pause and hand the problem to Salvador','Job and customer history','SETUP_REQUIRED'),
  ('reactivation','60 day reactivation','About 60 days after completed paid work','["No active lead","No open quote","No active job","No payment issue","No complaint","No opt out"]','About 60 days, once','Send one no-pressure message','["Message sent once","Customer already returned"]','Any reply becomes a normal conversation','Customer history','SETUP_REQUIRED')
on conflict (id) do nothing;

create table if not exists public.tracking_links (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('Facebook','Website','QR code','Other')),
  campaign text not null,
  destination text not null,
  slug text not null unique,
  visits integer not null default 0,
  leads integer not null default 0,
  customers integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create or replace function public.control_touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare v_table text;
begin
  foreach v_table in array array['customers','leads','quotes','jobs','invoices','workers','worker_payments','control_center_settings','automation_rules']
  loop
    execute format('drop trigger if exists control_touch_updated_at on public.%I', v_table);
    execute format('create trigger control_touch_updated_at before update on public.%I for each row execute function public.control_touch_updated_at()', v_table);
  end loop;
end;
$$;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'customers','leads','quotes','quote_items','jobs','invoices','invoice_tickets','payments',
    'workers','worker_payments','activity_history','financial_history','lead_messages',
    'attention_snoozes','control_center_settings','automation_rules','tracking_links'
  ] loop
    execute format('grant select, insert, update on public.%I to authenticated', v_table);
    execute format('grant all on public.%I to service_role', v_table);
    execute format('alter table public.%I enable row level security', v_table);
    execute format('drop policy if exists control_center_read on public.%I', v_table);
    execute format('drop policy if exists control_center_insert on public.%I', v_table);
    execute format('drop policy if exists control_center_update on public.%I', v_table);
    execute format('create policy control_center_read on public.%I for select to authenticated using (public.is_admin_or_staff())', v_table);
    execute format('create policy control_center_insert on public.%I for insert to authenticated with check (public.is_admin_or_staff())', v_table);
    if v_table not in ('activity_history','financial_history') then
      execute format('create policy control_center_update on public.%I for update to authenticated using (public.is_admin_or_staff()) with check (public.is_admin_or_staff())', v_table);
    end if;
    -- No DELETE policy. Historical and operational records cannot silently disappear.
  end loop;
end;
$$;

grant usage, select on sequence public.quote_number_seq to service_role;
grant usage, select on sequence public.invoice_number_seq to service_role;

revoke all on function public.is_admin_or_staff() from public, anon;
grant execute on function public.is_admin_or_staff() to authenticated;