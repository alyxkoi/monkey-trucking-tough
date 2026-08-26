begin;

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

create or replace function public.next_quote_number()
returns text language sql security definer set search_path = public, pg_temp as $$
  select 'Q' || nextval('public.quote_number_seq')::text;
$$;
create or replace function public.next_invoice_number()
returns text language sql security definer set search_path = public, pg_temp as $$
  select nextval('public.invoice_number_seq')::text;
$$;
revoke all on function public.next_quote_number() from public, anon, authenticated;
revoke all on function public.next_invoice_number() from public, anon, authenticated;

create or replace function public.find_or_create_customer(
  p_name text,
  p_phone text default null,
  p_email text default null
)
returns public.customers
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_customer public.customers%rowtype;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Customer name is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(v_phone, '') || '|' || coalesce(v_email, ''), 0));

  select * into v_customer from public.customers
  where (v_phone is not null and normalized_phone = v_phone)
     or (v_email is not null and normalized_email = v_email)
  order by last_activity_at desc limit 1 for update;

  if found then
    update public.customers set
      phone = coalesce(phone, nullif(trim(p_phone), '')),
      email = coalesce(email, nullif(trim(p_email), '')),
      normalized_phone = coalesce(normalized_phone, v_phone),
      normalized_email = coalesce(normalized_email, v_email),
      last_activity_at = now()
    where id = v_customer.id returning * into v_customer;
  else
    insert into public.customers (name, phone, normalized_phone, email, normalized_email)
    values (trim(p_name), nullif(trim(p_phone), ''), v_phone, nullif(trim(p_email), ''), v_email)
    returning * into v_customer;
  end if;
  return v_customer;
end;
$$;

create or replace function public.create_lead_with_customer(
  p_name text, p_phone text, p_email text, p_source text, p_campaign text, p_need text
)
returns table (lead_id uuid, customer_id uuid, matched_existing boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_before integer;
  v_customer public.customers%rowtype;
  v_lead_id uuid;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  select count(*) into v_before from public.customers
    where normalized_phone = nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '')
       or normalized_email = nullif(lower(trim(coalesce(p_email, ''))), '');
  v_customer := public.find_or_create_customer(p_name, p_phone, p_email);
  insert into public.leads (customer_id, source, campaign, need)
    values (v_customer.id, p_source, nullif(trim(p_campaign), ''), trim(p_need)) returning id into v_lead_id;
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, actor_label)
    values (v_customer.id, 'LEAD', v_lead_id, 'CREATED', 'Lead created', coalesce(auth.jwt()->>'email', auth.uid()::text));
  return query select v_lead_id, v_customer.id, v_before > 0;
end;
$$;

create or replace function public.create_job_with_customer(
  p_name text, p_phone text, p_email text, p_customer_id uuid, p_quote_id uuid,
  p_category text, p_date date, p_time time, p_all_day boolean, p_address text,
  p_description text, p_agreed_amount numeric, p_notes text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_customer public.customers%rowtype; v_customer_id uuid; v_job_id uuid;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  if p_customer_id is null then
    v_customer := public.find_or_create_customer(p_name, p_phone, p_email);
    v_customer_id := v_customer.id;
  else
    v_customer_id := p_customer_id;
  end if;
  insert into public.jobs (customer_id, quote_id, category, scheduled_date, scheduled_time, all_day, address, description, agreed_amount, notes)
  values (v_customer_id, p_quote_id, p_category, p_date, case when p_all_day then null else p_time end, p_all_day, trim(p_address), trim(p_description), p_agreed_amount, nullif(trim(p_notes), ''))
  returning id into v_job_id;
  if p_quote_id is not null then
    update public.quotes set status = 'ACCEPTED', accepted_at = coalesce(accepted_at, now()) where id = p_quote_id;
    update public.leads set status = 'WON' where id = (select lead_id from public.quotes where id = p_quote_id);
  end if;
  update public.customers set last_activity_at = now() where id = v_customer_id;
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, actor_label)
    values (v_customer_id, 'JOB', v_job_id, 'SCHEDULED', 'Job scheduled', coalesce(auth.jwt()->>'email', auth.uid()::text));
  return v_job_id;
end;
$$;

create or replace function public.save_quote_atomic(p_quote jsonb, p_items jsonb)
returns table (id uuid, quote_number text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_number text; v_customer_id uuid; v_lead_id uuid;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  v_customer_id := (p_quote->>'customer_id')::uuid;
  v_lead_id := nullif(p_quote->>'lead_id', '')::uuid;
  if jsonb_array_length(p_items) = 0 then raise exception 'At least one quote item is required'; end if;
  v_number := public.next_quote_number();
  insert into public.quotes (
    quote_number, customer_id, lead_id, status, description, address, delivery_type, delivery_miles,
    delivery_fee_per_load, delivery_load_count, delivery_total, materials_subtotal,
    custom_work_subtotal, tax_rate, tax_applies_to_delivery, custom_work_tax_rule,
    tax_amount, grand_total, notes
  ) values (
    v_number, v_customer_id, v_lead_id, coalesce(nullif(p_quote->>'status',''),'DRAFT'),
    coalesce(p_quote->>'description',''), coalesce(p_quote->>'address',''), nullif(p_quote->>'delivery_type',''),
    nullif(p_quote->>'delivery_miles','')::numeric, coalesce((p_quote->>'delivery_fee_per_load')::numeric,0),
    coalesce((p_quote->>'delivery_load_count')::integer,1), coalesce((p_quote->>'delivery_total')::numeric,0),
    coalesce((p_quote->>'materials_subtotal')::numeric,0), coalesce((p_quote->>'custom_work_subtotal')::numeric,0),
    coalesce((p_quote->>'tax_rate')::numeric,0), coalesce((p_quote->>'tax_applies_to_delivery')::boolean,true),
    coalesce(nullif(p_quote->>'custom_work_tax_rule',''),'PENDING'), coalesce((p_quote->>'tax_amount')::numeric,0),
    coalesce((p_quote->>'grand_total')::numeric,0), nullif(p_quote->>'notes','')
  ) returning public.quotes.id into v_id;
  insert into public.quote_items (quote_id, kind, material_id, description, loads, yards, is_full_load, rate_used, line_total)
  select v_id, item->>'kind', nullif(item->>'material_id','')::uuid, item->>'description',
    nullif(item->>'loads','')::integer, nullif(item->>'yards','')::numeric,
    coalesce((item->>'is_full_load')::boolean,false), coalesce((item->>'rate_used')::numeric,0),
    coalesce((item->>'line_total')::numeric,0)
  from jsonb_array_elements(p_items) as elements(item);
  if v_lead_id is not null then update public.leads set status = 'QUOTED' where public.leads.id = v_lead_id; end if;
  update public.customers set last_activity_at = now() where public.customers.id = v_customer_id;
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, actor_label)
    values (v_customer_id, 'QUOTE', v_id, 'CREATED', 'Quote ' || v_number || ' created', coalesce(auth.jwt()->>'email', auth.uid()::text));
  return query select v_id, v_number;
end;
$$;

-- A distinctly named compatibility RPC prevents PostgREST ambiguity when both
-- the approved UUID overload and Lovable's later text overload exist.
create or replace function public.create_ticket_compat_atomic(
  p_ticket jsonb, p_items jsonb, p_client_request_id text,
  p_preserve_legacy_unknowns boolean default false
)
returns table (id uuid, ticket_number text, created boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_number text; v_existing public.tickets%rowtype;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  if nullif(trim(p_client_request_id),'') is null then raise exception 'Client request id is required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_client_request_id, 0));
  select * into v_existing from public.tickets where client_request_id::text = p_client_request_id;
  if found then
    return query select v_existing.id, v_existing.ticket_number, false;
    return;
  end if;

  -- Prefer the approved UUID overload. If the managed project only has the
  -- Lovable text overload, call that instead. UUID-formatted request ids are
  -- used by the client in either case.
  if to_regprocedure('public.create_ticket_atomic(jsonb,jsonb,uuid,boolean)') is not null then
    execute 'select x.id, x.ticket_number from public.create_ticket_atomic($1,$2,$3::uuid,$4) x'
      into v_id, v_number using p_ticket, p_items, p_client_request_id, p_preserve_legacy_unknowns;
  else
    execute 'select x.id, x.ticket_number from public.create_ticket_atomic($1,$2,$3::text,$4) x'
      into v_id, v_number using p_ticket, p_items, p_client_request_id, p_preserve_legacy_unknowns;
  end if;
  if v_id is null then raise exception 'Ticket save returned no record'; end if;
  return query select v_id, v_number, true;
end;
$$;

create or replace function public.create_control_center_ticket_atomic(
  p_ticket jsonb, p_items jsonb, p_client_request_id text, p_customer_id uuid,
  p_job_id uuid default null, p_preserve_legacy_unknowns boolean default false
)
returns table (id uuid, ticket_number text, created boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_result record;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  if not exists (select 1 from public.customers where public.customers.id = p_customer_id) then raise exception 'Customer not found'; end if;
  if p_job_id is not null and not exists (
    select 1 from public.jobs where public.jobs.id = p_job_id and customer_id = p_customer_id
  ) then raise exception 'Job does not belong to this customer'; end if;

  select * into v_result from public.create_ticket_compat_atomic(
    p_ticket, p_items, p_client_request_id, p_preserve_legacy_unknowns
  );
  if not v_result.created then
    if exists (
      select 1 from public.tickets t where t.id=v_result.id
        and (t.customer_id is distinct from p_customer_id or t.job_id is distinct from p_job_id)
    ) then raise exception 'Idempotency key already belongs to a different Ticket context'; end if;
    return query select v_result.id, v_result.ticket_number, false;
    return;
  end if;

  perform set_config('app.ticket_safe_write', 'true', true);
  update public.tickets set customer_id = p_customer_id, job_id = p_job_id where public.tickets.id = v_result.id;
  insert into public.ticket_history (ticket_id, event_type, actor_id, actor_label, after_snapshot)
    values (
      v_result.id,
      'context_linked',
      auth.uid(),
      coalesce(auth.jwt()->>'email', auth.uid()::text),
      jsonb_build_object('customer_id', p_customer_id, 'job_id', p_job_id)
    );
  update public.customers set last_activity_at = now() where public.customers.id = p_customer_id;
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, actor_label)
    values (p_customer_id, 'TICKET', v_result.id, 'CREATED', 'Ticket ' || v_result.ticket_number || ' created', coalesce(auth.jwt()->>'email', auth.uid()::text));
  return query select v_result.id, v_result.ticket_number, true;
end;
$$;

create or replace function public.create_invoice_from_job(p_job_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_job public.jobs%rowtype; v_id uuid; v_number text; v_source text;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found or v_job.status <> 'COMPLETED' then raise exception 'Only a completed job can be invoiced'; end if;
  select id into v_id from public.invoices where job_id = p_job_id and status <> 'VOID';
  if found then return v_id; end if;
  v_number := public.next_invoice_number();
  v_source := case when v_job.quote_id is null then 'JOB' else 'QUOTE' end;
  insert into public.invoices (invoice_number, customer_id, job_id, quote_id, amount_source, description, amount)
    values (v_number, v_job.customer_id, v_job.id, v_job.quote_id, v_source, v_job.description, v_job.agreed_amount)
    returning id into v_id;
  insert into public.invoice_tickets (invoice_id, ticket_id)
    select v_id, id from public.tickets where job_id = p_job_id and status <> 'void' on conflict do nothing;
  insert into public.financial_history (record_type, record_id, event_type, reason, after_snapshot, actor_label)
    values (
      'INVOICE', v_id, 'CREATED', 'Invoice created from completed job',
      (select to_jsonb(i) from public.invoices i where id=v_id),
      coalesce(auth.jwt()->>'email',auth.uid()::text)
    );
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, actor_label)
    values (v_job.customer_id, 'INVOICE', v_id, 'CREATED', 'Invoice ' || v_number || ' created', coalesce(auth.jwt()->>'email',auth.uid()::text));
  return v_id;
end;
$$;

create or replace function public.create_invoice_from_standalone_ticket(p_ticket_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ticket public.tickets%rowtype; v_id uuid; v_number text;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found or coalesce(v_ticket.status,'') not in ('saved','active') or v_ticket.job_id is not null or v_ticket.customer_id is null then
    raise exception 'Ticket is not an eligible finalized standalone ticket';
  end if;
  select i.id into v_id
  from public.invoices i
  where i.standalone_ticket_id = p_ticket_id and i.status <> 'VOID';
  if found then return v_id; end if;
  v_number := public.next_invoice_number();
  insert into public.invoices (invoice_number, customer_id, standalone_ticket_id, amount_source, description, amount)
    values (v_number, v_ticket.customer_id, p_ticket_id, 'TICKET', 'Direct material order ' || v_ticket.ticket_number, v_ticket.grand_total)
    returning id into v_id;
  insert into public.invoice_tickets (invoice_id, ticket_id) values (v_id, p_ticket_id);
  insert into public.financial_history (record_type, record_id, event_type, reason, after_snapshot, actor_label)
    values (
      'INVOICE', v_id, 'CREATED', 'Invoice created from finalized standalone Ticket',
      (select to_jsonb(i) from public.invoices i where id=v_id),
      coalesce(auth.jwt()->>'email',auth.uid()::text)
    );
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, actor_label)
    values (v_ticket.customer_id, 'INVOICE', v_id, 'CREATED', 'Invoice ' || v_number || ' created from ' || v_ticket.ticket_number, coalesce(auth.jwt()->>'email',auth.uid()::text));
  return v_id;
end;
$$;

create or replace function public.record_invoice_payment_full(
  p_invoice_id uuid, p_method text, p_received_at timestamptz, p_note text default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_invoice public.invoices%rowtype; v_paid numeric; v_outstanding numeric; v_id uuid;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found or v_invoice.status in ('PAID','VOID') then raise exception 'Invoice is not eligible for payment'; end if;
  select coalesce(sum(amount),0) into v_paid from public.payments where invoice_id = p_invoice_id and voided_at is null;
  v_outstanding := round(v_invoice.amount - v_paid, 2);
  if v_outstanding <= 0 then raise exception 'Invoice has no outstanding balance'; end if;
  insert into public.payments (invoice_id, customer_id, amount, method, confirmed_by, note, received_at)
    values (v_invoice.id, v_invoice.customer_id, v_outstanding, p_method, 'HUMAN', nullif(trim(p_note),''), coalesce(p_received_at,now()))
    returning id into v_id;
  perform set_config('app.financial_safe_write', 'true', true);
  update public.invoices set status = 'PAID', paid_at = coalesce(p_received_at,now()) where id = p_invoice_id;
  insert into public.financial_history (record_type, record_id, event_type, reason, after_snapshot, actor_label)
    values ('PAYMENT', v_id, 'RECORDED', 'Full outstanding balance recorded', jsonb_build_object('amount',v_outstanding,'method',p_method), coalesce(auth.jwt()->>'email',auth.uid()::text));
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, metadata, actor_label)
    values (
      v_invoice.customer_id, 'PAYMENT', v_id, 'RECORDED', 'Full payment recorded for invoice ' || v_invoice.invoice_number,
      jsonb_build_object('amount',v_outstanding,'invoice_id',v_invoice.id),
      coalesce(auth.jwt()->>'email',auth.uid()::text)
    );
  update public.customers set last_activity_at = now() where id = v_invoice.customer_id;
  return v_id;
end;
$$;

create or replace function public.create_worker_payment_pending(
  p_worker_id uuid, p_period_start date, p_period_end date, p_hours numeric,
  p_rate numeric, p_amount numeric, p_source text, p_attachment_path text default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  if not exists (select 1 from public.workers where id=p_worker_id and is_active) then raise exception 'Active worker not found'; end if;
  if p_period_end < p_period_start or p_amount <= 0 then raise exception 'Invalid worker payment period or amount'; end if;
  insert into public.worker_payments (
    worker_id, period_start, period_end, hours, rate, amount, status, source, attachment_path
  ) values (
    p_worker_id, p_period_start, p_period_end, p_hours, p_rate, p_amount, 'PENDING', p_source, nullif(trim(p_attachment_path),'')
  ) returning id into v_id;
  insert into public.financial_history (record_type, record_id, event_type, reason, after_snapshot, actor_label)
    values (
      'WORKER_PAYMENT', v_id, 'CREATED_PENDING', 'Pending worker pay created',
      (select to_jsonb(w) from public.worker_payments w where id=v_id),
      coalesce(auth.jwt()->>'email',auth.uid()::text)
    );
  return v_id;
end;
$$;

create or replace function public.confirm_worker_payment_details(p_worker_payment_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_before public.worker_payments%rowtype;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  select * into v_before from public.worker_payments where id = p_worker_payment_id for update;
  if not found or v_before.status <> 'PENDING' then raise exception 'Only pending worker pay details can be confirmed'; end if;
  perform set_config('app.financial_safe_write', 'true', true);
  update public.worker_payments set status='CONFIRMED', confirmed_at=now() where id=p_worker_payment_id;
  insert into public.financial_history (record_type, record_id, event_type, reason, before_snapshot, after_snapshot, actor_label)
    values ('WORKER_PAYMENT',p_worker_payment_id,'DETAILS_CONFIRMED','Detected or entered details confirmed',to_jsonb(v_before),(select to_jsonb(w) from public.worker_payments w where id=p_worker_payment_id),coalesce(auth.jwt()->>'email',auth.uid()::text));
end;
$$;

create or replace function public.mark_worker_payment_paid(p_worker_payment_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_before public.worker_payments%rowtype;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  select * into v_before from public.worker_payments where id = p_worker_payment_id for update;
  if not found or v_before.status not in ('PENDING','CONFIRMED') then raise exception 'Worker payment is not eligible to mark paid'; end if;
  perform set_config('app.financial_safe_write', 'true', true);
  update public.worker_payments set status='PAID', paid_at=now(), confirmed_at=coalesce(confirmed_at,now()) where id=p_worker_payment_id;
  insert into public.financial_history (record_type, record_id, event_type, reason, before_snapshot, after_snapshot, actor_label)
    values ('WORKER_PAYMENT',p_worker_payment_id,'PAID','Salvador explicitly marked the worker paid',to_jsonb(v_before),(select to_jsonb(w) from public.worker_payments w where id=p_worker_payment_id),coalesce(auth.jwt()->>'email',auth.uid()::text));
end;
$$;

create or replace function public.enforce_financial_safe_write()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_setting('app.financial_safe_write', true) = 'true' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_table_name = 'invoices' and tg_op = 'UPDATE'
    and new.status <> 'VOID'
    and (new.status = old.status or (old.status = 'DRAFT' and new.status = 'SENT'))
    and (to_jsonb(new) - 'status' - 'issued_at' - 'due_at' - 'disputed' - 'dispute_note'
      - 'payment_claimed_at' - 'payment_claim_method' - 'payment_claim_note' - 'updated_at')
      = (to_jsonb(old) - 'status' - 'issued_at' - 'due_at' - 'disputed' - 'dispute_note'
      - 'payment_claimed_at' - 'payment_claim_method' - 'payment_claim_note' - 'updated_at') then
    return new;
  end if;
  raise exception 'Important financial records must be changed through an approved history-writing function'
    using errcode = '42501';
end;
$$;

drop trigger if exists control_financial_safe_write on public.invoices;
create trigger control_financial_safe_write before update or delete on public.invoices
  for each row execute function public.enforce_financial_safe_write();
drop trigger if exists control_financial_safe_write on public.payments;
create trigger control_financial_safe_write before update or delete on public.payments
  for each row execute function public.enforce_financial_safe_write();
drop trigger if exists control_financial_safe_write on public.worker_payments;
create trigger control_financial_safe_write before update or delete on public.worker_payments
  for each row execute function public.enforce_financial_safe_write();

create or replace function public.void_financial_record(p_record_type text, p_record_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_before jsonb; v_invoice_id uuid;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A reason is required'; end if;
  perform set_config('app.financial_safe_write', 'true', true);
  if p_record_type = 'INVOICE' then
    select to_jsonb(i) into v_before from public.invoices i where id = p_record_id for update;
    if exists (select 1 from public.payments where invoice_id=p_record_id and voided_at is null) then
      raise exception 'Void the related payment before voiding this invoice';
    end if;
    update public.invoices set status='VOID', voided_at=now(), void_reason=trim(p_reason), voided_by=auth.uid() where id=p_record_id and status<>'VOID';
  elsif p_record_type = 'PAYMENT' then
    select to_jsonb(p), p.invoice_id into v_before, v_invoice_id from public.payments p where id = p_record_id for update;
    update public.payments set voided_at=now(), void_reason=trim(p_reason), voided_by=auth.uid() where id=p_record_id and voided_at is null;
    update public.invoices i
      set status='SENT', paid_at=null
      where i.id=v_invoice_id and i.status='PAID'
        and coalesce((select sum(p.amount) from public.payments p where p.invoice_id=i.id and p.voided_at is null),0) < i.amount;
  elsif p_record_type = 'WORKER_PAYMENT' then
    select to_jsonb(w) into v_before from public.worker_payments w where id = p_record_id for update;
    update public.worker_payments set status='VOID', voided_at=now(), void_reason=trim(p_reason), voided_by=auth.uid() where id=p_record_id and status<>'VOID';
  else raise exception 'Unknown financial record type';
  end if;
  if v_before is null then raise exception 'Financial record not found'; end if;
  insert into public.financial_history (record_type, record_id, event_type, reason, before_snapshot, actor_label)
    values (p_record_type, p_record_id, 'VOIDED', trim(p_reason), v_before, coalesce(auth.jwt()->>'email',auth.uid()::text));
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

revoke all on function public.find_or_create_customer(text,text,text) from public, anon;
revoke all on function public.is_admin_or_staff() from public, anon;
revoke all on function public.create_lead_with_customer(text,text,text,text,text,text) from public, anon;
revoke all on function public.create_job_with_customer(text,text,text,uuid,uuid,text,date,time,boolean,text,text,numeric,text) from public, anon;
revoke all on function public.save_quote_atomic(jsonb,jsonb) from public, anon;
revoke all on function public.create_ticket_compat_atomic(jsonb,jsonb,text,boolean) from public, anon;
revoke all on function public.create_control_center_ticket_atomic(jsonb,jsonb,text,uuid,uuid,boolean) from public, anon;
revoke all on function public.create_invoice_from_job(uuid) from public, anon;
revoke all on function public.create_invoice_from_standalone_ticket(uuid) from public, anon;
revoke all on function public.record_invoice_payment_full(uuid,text,timestamptz,text) from public, anon;
revoke all on function public.create_worker_payment_pending(uuid,date,date,numeric,numeric,numeric,text,text) from public, anon;
revoke all on function public.void_financial_record(text,uuid,text) from public, anon;
revoke all on function public.confirm_worker_payment_details(uuid) from public, anon;
revoke all on function public.mark_worker_payment_paid(uuid) from public, anon;

grant execute on function public.find_or_create_customer(text,text,text) to authenticated;
grant execute on function public.is_admin_or_staff() to authenticated;
grant execute on function public.create_lead_with_customer(text,text,text,text,text,text) to authenticated;
grant execute on function public.create_job_with_customer(text,text,text,uuid,uuid,text,date,time,boolean,text,text,numeric,text) to authenticated;
grant execute on function public.save_quote_atomic(jsonb,jsonb) to authenticated;
grant execute on function public.create_ticket_compat_atomic(jsonb,jsonb,text,boolean) to authenticated;
grant execute on function public.create_control_center_ticket_atomic(jsonb,jsonb,text,uuid,uuid,boolean) to authenticated;
grant execute on function public.create_invoice_from_job(uuid) to authenticated;
grant execute on function public.create_invoice_from_standalone_ticket(uuid) to authenticated;
grant execute on function public.record_invoice_payment_full(uuid,text,timestamptz,text) to authenticated;
grant execute on function public.create_worker_payment_pending(uuid,date,date,numeric,numeric,numeric,text,text) to authenticated;
grant execute on function public.void_financial_record(text,uuid,text) to authenticated;
grant execute on function public.confirm_worker_payment_details(uuid) to authenticated;
grant execute on function public.mark_worker_payment_paid(uuid) to authenticated;

commit;
