-- Phase 06 Stripe Checkout for authoritative Monkey Trucking invoices.
-- Forward-only: historical invoices/payments remain unchanged, Ticket snapshots and
-- numbering are untouched, and legacy Payment provider fields remain NULL.

do $$
begin
  if to_regclass('public.invoices') is null
    or to_regclass('public.payments') is null
    or to_regclass('public.customer_document_tokens') is null
    or to_regclass('public.email_send_log') is null then
    raise exception 'Apply the Control Center and transactional customer email migrations before Stripe Checkout';
  end if;
end;
$$;

alter table public.payments
  add column if not exists payment_source text,
  add column if not exists provider_payment_method_type text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_event_id text;

alter table public.payments drop constraint if exists payments_payment_source_check;
alter table public.payments add constraint payments_payment_source_check
  check (payment_source is null or payment_source in ('MANUAL','STRIPE'));

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('ACH','CARD','ZELLE','APPLE_PAY','CHECK','OTHER','STRIPE'));

create unique index if not exists payments_stripe_checkout_session_unique
  on public.payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create unique index if not exists payments_stripe_payment_intent_unique
  on public.payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create unique index if not exists payments_stripe_event_unique
  on public.payments (stripe_event_id)
  where stripe_event_id is not null;

create table if not exists public.stripe_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  document_token_id uuid not null references public.customer_document_tokens(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  checkout_url text,
  livemode boolean,
  status text not null default 'CREATING'
    check (status in ('CREATING','OPEN','COMPLETE','EXPIRED','FAILED','RECONCILIATION_REQUIRED')),
  expires_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists stripe_checkout_one_active_amount
  on public.stripe_checkout_sessions (invoice_id, amount_cents)
  where status in ('CREATING','OPEN');
create index if not exists stripe_checkout_invoice_idx
  on public.stripe_checkout_sessions (invoice_id, created_at desc);

create table if not exists public.stripe_webhook_events (
  provider_event_id text primary key,
  event_type text not null,
  stripe_session_id text,
  stripe_payment_intent_id text,
  invoice_id uuid references public.invoices(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete restrict,
  livemode boolean,
  status text not null default 'RECEIVED'
    check (status in ('RECEIVED','PROCESSING','PROCESSED','IGNORED','FAILED','RECONCILIATION_REQUIRED')),
  error_message text,
  receipt_email_status text
    check (receipt_email_status is null or receipt_email_status in ('NOT_REQUIRED','PENDING','ACCEPTED','SKIPPED_NO_EMAIL','RETRY_REQUIRED')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists stripe_webhook_attention_idx
  on public.stripe_webhook_events (status, received_at desc)
  where status in ('FAILED','RECONCILIATION_REQUIRED');

alter table public.stripe_checkout_sessions enable row level security;
alter table public.stripe_webhook_events enable row level security;

revoke all on public.stripe_checkout_sessions from public, anon, authenticated;
revoke all on public.stripe_webhook_events from public, anon, authenticated;
grant all on public.stripe_checkout_sessions to service_role;
grant all on public.stripe_webhook_events to service_role;
grant select on public.stripe_checkout_sessions, public.stripe_webhook_events to authenticated;

drop policy if exists "Admin staff can inspect Stripe checkout sessions" on public.stripe_checkout_sessions;
create policy "Admin staff can inspect Stripe checkout sessions"
  on public.stripe_checkout_sessions for select to authenticated
  using (public.is_admin_or_staff());
drop policy if exists "Admin staff can inspect Stripe webhook events" on public.stripe_webhook_events;
create policy "Admin staff can inspect Stripe webhook events"
  on public.stripe_webhook_events for select to authenticated
  using (public.is_admin_or_staff());

-- Reserve one active session per authoritative invoice amount. The Edge Function
-- creates the Stripe object only after this database reservation succeeds.
create or replace function public.reserve_stripe_checkout_session(
  p_invoice_id uuid,
  p_document_token_id uuid,
  p_amount_cents bigint
)
returns public.stripe_checkout_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_paid numeric;
  v_due_cents bigint;
  v_session public.stripe_checkout_sessions%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found or v_invoice.status <> 'SENT' or v_invoice.voided_at is not null then
    raise exception 'Invoice is not payable';
  end if;
  if v_invoice.disputed then raise exception 'Invoice is disputed'; end if;
  if not exists (
    select 1 from public.customer_document_tokens t
    where t.id = p_document_token_id and t.invoice_id = p_invoice_id
      and t.document_type = 'INVOICE' and t.revoked_at is null
  ) then raise exception 'Secure invoice token is not valid'; end if;

  select coalesce(sum(amount),0) into v_paid
  from public.payments where invoice_id = p_invoice_id and voided_at is null;
  v_due_cents := round((v_invoice.amount - v_paid) * 100)::bigint;
  if v_due_cents <= 0 or p_amount_cents <> v_due_cents then
    raise exception 'Authoritative invoice amount changed';
  end if;

  update public.stripe_checkout_sessions
    set status = 'EXPIRED', updated_at = now(), failure_reason = coalesce(failure_reason, 'Session expired before reuse')
    where invoice_id = p_invoice_id and status = 'OPEN' and expires_at <= now();

  select * into v_session
  from public.stripe_checkout_sessions
  where invoice_id = p_invoice_id and amount_cents = p_amount_cents
    and status in ('CREATING','OPEN')
  order by created_at desc limit 1;
  if found then return v_session; end if;

  begin
    insert into public.stripe_checkout_sessions (invoice_id, document_token_id, amount_cents)
      values (p_invoice_id, p_document_token_id, p_amount_cents)
      returning * into v_session;
  exception when unique_violation then
    select * into v_session
    from public.stripe_checkout_sessions
    where invoice_id = p_invoice_id and amount_cents = p_amount_cents
      and status in ('CREATING','OPEN')
    order by created_at desc limit 1;
  end;
  return v_session;
end;
$$;

create or replace function public.activate_stripe_checkout_session(
  p_reservation_id uuid,
  p_stripe_session_id text,
  p_checkout_url text,
  p_expires_at timestamptz,
  p_livemode boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  update public.stripe_checkout_sessions
    set stripe_session_id = p_stripe_session_id,
        checkout_url = p_checkout_url,
        expires_at = p_expires_at,
        livemode = p_livemode,
        status = 'OPEN',
        failure_reason = null,
        updated_at = now()
    where id = p_reservation_id and status in ('CREATING','OPEN');
  if not found then raise exception 'Checkout reservation is no longer active'; end if;
end;
$$;

create or replace function public.fail_stripe_checkout_session(p_reservation_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  update public.stripe_checkout_sessions
    set status = 'FAILED', failure_reason = left(coalesce(p_reason,'Checkout creation failed'),1000), updated_at = now()
    where id = p_reservation_id and status = 'CREATING';
end;
$$;

-- Service-only, atomic Stripe payment finalization. Provider event/session/payment
-- intent IDs enforce exactly-once business Payment creation.
create or replace function public.process_stripe_checkout_payment(
  p_event_id text,
  p_event_type text,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text,
  p_amount_cents bigint,
  p_currency text,
  p_livemode boolean,
  p_provider_payment_method_type text,
  p_paid_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.stripe_checkout_sessions%rowtype;
  v_invoice public.invoices%rowtype;
  v_existing public.payments%rowtype;
  v_payment_id uuid;
  v_paid numeric;
  v_due_cents bigint;
  v_reason text;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;

  insert into public.stripe_webhook_events (
    provider_event_id, event_type, stripe_session_id, stripe_payment_intent_id, livemode, status
  ) values (p_event_id, p_event_type, p_stripe_session_id, p_stripe_payment_intent_id, p_livemode, 'PROCESSING')
  on conflict (provider_event_id) do update
    set attempt_count = stripe_webhook_events.attempt_count + 1, updated_at = now();

  select * into v_existing from public.payments
  where stripe_event_id = p_event_id
     or stripe_checkout_session_id = p_stripe_session_id
     or (p_stripe_payment_intent_id is not null and stripe_payment_intent_id = p_stripe_payment_intent_id)
  limit 1;
  if found then
    update public.stripe_webhook_events
      set status='PROCESSED', invoice_id=v_existing.invoice_id, payment_id=v_existing.id,
          processed_at=coalesce(processed_at,now()), error_message=null, updated_at=now()
      where provider_event_id=p_event_id;
    return jsonb_build_object(
      'result_status', 'ALREADY_PROCESSED',
      'payment_id', v_existing.id,
      'invoice_id', v_existing.invoice_id
    );
  end if;

  select * into v_session from public.stripe_checkout_sessions
  where stripe_session_id = p_stripe_session_id for update;
  if not found then
    v_reason := 'Stripe session does not match a server-created Checkout reservation';
    update public.stripe_webhook_events set status='RECONCILIATION_REQUIRED', error_message=v_reason, updated_at=now()
      where provider_event_id=p_event_id;
    return jsonb_build_object(
      'result_status', 'RECONCILIATION_REQUIRED',
      'payment_id', null,
      'invoice_id', null
    );
  end if;

  select * into v_invoice from public.invoices where id=v_session.invoice_id for update;
  select coalesce(sum(amount),0) into v_paid from public.payments
    where public.payments.invoice_id=v_invoice.id and voided_at is null;
  v_due_cents := round((v_invoice.amount-v_paid)*100)::bigint;

  if p_currency <> 'usd' or p_amount_cents <> v_session.amount_cents
    or p_amount_cents <> v_due_cents or v_invoice.status <> 'SENT'
    or v_invoice.disputed or v_invoice.voided_at is not null
    or (v_session.livemode is not null and v_session.livemode <> p_livemode) then
    v_reason := 'Stripe payment does not match the current payable invoice state';
    update public.stripe_checkout_sessions
      set status='RECONCILIATION_REQUIRED', stripe_payment_intent_id=p_stripe_payment_intent_id,
          failure_reason=v_reason, updated_at=now() where id=v_session.id;
    update public.stripe_webhook_events
      set status='RECONCILIATION_REQUIRED', invoice_id=v_invoice.id, error_message=v_reason, updated_at=now()
      where provider_event_id=p_event_id;
    insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, metadata, actor_label)
      values (v_invoice.customer_id, 'INVOICE', v_invoice.id, 'STRIPE_RECONCILIATION_REQUIRED',
        'Stripe payment requires reconciliation', jsonb_build_object('event_id',p_event_id,'session_id',p_stripe_session_id),
        'Stripe payment service');
    return jsonb_build_object(
      'result_status', 'RECONCILIATION_REQUIRED',
      'payment_id', null,
      'invoice_id', v_invoice.id
    );
  end if;

  insert into public.payments (
    invoice_id, customer_id, amount, method, confirmed_by, note, received_at,
    payment_source, provider_payment_method_type, stripe_checkout_session_id,
    stripe_payment_intent_id, stripe_event_id
  ) values (
    v_invoice.id, v_invoice.customer_id, p_amount_cents::numeric/100, 'STRIPE', 'PROCESSOR',
    'Verified Stripe Checkout payment', coalesce(p_paid_at,now()), 'STRIPE',
    nullif(trim(p_provider_payment_method_type),''), p_stripe_session_id,
    nullif(trim(p_stripe_payment_intent_id),''), p_event_id
  ) returning id into v_payment_id;

  perform set_config('app.financial_safe_write', 'true', true);
  update public.invoices set status='PAID', paid_at=coalesce(p_paid_at,now()), updated_at=now()
    where id=v_invoice.id;
  update public.stripe_checkout_sessions
    set status='COMPLETE', stripe_payment_intent_id=p_stripe_payment_intent_id,
        checkout_url=null, updated_at=now() where id=v_session.id;
  update public.stripe_webhook_events
    set status='PROCESSED', invoice_id=v_invoice.id, payment_id=v_payment_id,
        receipt_email_status='PENDING', processed_at=now(), error_message=null, updated_at=now()
    where provider_event_id=p_event_id;

  insert into public.financial_history (record_type, record_id, event_type, reason, after_snapshot, actor_label)
    values ('PAYMENT',v_payment_id,'RECORDED','Verified Stripe Checkout full payment',
      jsonb_build_object('amount',p_amount_cents::numeric/100,'source','STRIPE','session_id',p_stripe_session_id),
      'Stripe payment service');
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, metadata, actor_label)
    values (v_invoice.customer_id,'PAYMENT',v_payment_id,'RECORDED',
      'Stripe payment recorded for invoice '||v_invoice.invoice_number,
      jsonb_build_object('amount',p_amount_cents::numeric/100,'invoice_id',v_invoice.id),
      'Stripe payment service');
  update public.customers set last_activity_at=now() where id=v_invoice.customer_id;

  return jsonb_build_object(
    'result_status', 'PROCESSED',
    'payment_id', v_payment_id,
    'invoice_id', v_invoice.id
  );
end;
$$;

create or replace function public.mark_stripe_checkout_terminal(
  p_event_id text,
  p_event_type text,
  p_stripe_session_id text,
  p_status text,
  p_livemode boolean
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  insert into public.stripe_webhook_events (provider_event_id,event_type,stripe_session_id,livemode,status,processed_at)
    values (p_event_id,p_event_type,p_stripe_session_id,p_livemode,'PROCESSED',now())
  on conflict (provider_event_id) do update
    set attempt_count=stripe_webhook_events.attempt_count+1,status='PROCESSED',processed_at=coalesce(stripe_webhook_events.processed_at,now()),updated_at=now();
  update public.stripe_checkout_sessions
    set status=case when p_status='EXPIRED' then 'EXPIRED' else 'FAILED' end,
        checkout_url=null, failure_reason=case when p_status='EXPIRED' then 'Checkout expired' else 'Stripe payment failed' end,
        updated_at=now()
    where stripe_session_id=p_stripe_session_id and status in ('CREATING','OPEN');
end;
$$;

create or replace function public.revise_draft_invoice(
  p_invoice_id uuid, p_amount numeric, p_description text, p_reason text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_before public.invoices%rowtype;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode='42501'; end if;
  if p_amount <= 0 or nullif(trim(p_description),'') is null or nullif(trim(p_reason),'') is null then
    raise exception 'A positive amount, description, and reason are required';
  end if;
  select * into v_before from public.invoices where id=p_invoice_id for update;
  if not found or v_before.status <> 'DRAFT' then raise exception 'Only a draft Invoice can be revised'; end if;
  perform set_config('app.financial_safe_write','true',true);
  update public.invoices set amount=round(p_amount,2),description=trim(p_description),updated_at=now()
    where id=p_invoice_id;
  insert into public.financial_history (record_type,record_id,event_type,reason,before_snapshot,after_snapshot,actor_label)
    values ('INVOICE',p_invoice_id,'DRAFT_REVISED',trim(p_reason),to_jsonb(v_before),
      (select to_jsonb(i) from public.invoices i where i.id=p_invoice_id),coalesce(auth.jwt()->>'email',auth.uid()::text));
end;
$$;

-- Quoted Jobs source the accepted Quote snapshot. Direct Jobs retain their agreed
-- amount. Job-linked Ticket totals remain supporting proof only.
create or replace function public.create_invoice_from_job(p_job_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_job public.jobs%rowtype; v_quote public.quotes%rowtype; v_id uuid; v_number text; v_source text; v_amount numeric;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode='42501'; end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found or v_job.status <> 'COMPLETED' then raise exception 'Only a completed job can be invoiced'; end if;
  select id into v_id from public.invoices where job_id=p_job_id and status<>'VOID';
  if found then return v_id; end if;
  if v_job.quote_id is not null then
    select * into v_quote from public.quotes where id=v_job.quote_id;
    if not found or v_quote.status <> 'ACCEPTED' then raise exception 'The linked Quote is not accepted'; end if;
    v_source := 'QUOTE'; v_amount := v_quote.grand_total;
  else
    v_source := 'JOB'; v_amount := v_job.agreed_amount;
  end if;
  v_number := public.next_invoice_number();
  insert into public.invoices (invoice_number,customer_id,job_id,quote_id,amount_source,description,amount)
    values (v_number,v_job.customer_id,v_job.id,v_job.quote_id,v_source,v_job.description,coalesce(v_amount,0)) returning id into v_id;
  insert into public.invoice_tickets (invoice_id,ticket_id)
    select v_id,id from public.tickets where job_id=p_job_id and status<>'void' on conflict do nothing;
  insert into public.financial_history (record_type,record_id,event_type,reason,after_snapshot,actor_label)
    values ('INVOICE',v_id,'CREATED',case when v_source='QUOTE' then 'Draft Invoice created from accepted Quote snapshot' else 'Draft Invoice created from direct Job agreed amount' end,
      (select to_jsonb(i) from public.invoices i where i.id=v_id),coalesce(auth.jwt()->>'email',auth.uid()::text));
  insert into public.activity_history (customer_id,entity_type,entity_id,event_type,summary,actor_label)
    values (v_job.customer_id,'INVOICE',v_id,'CREATED','Draft Invoice '||v_number||' prepared for review',coalesce(auth.jwt()->>'email',auth.uid()::text));
  return v_id;
end;
$$;

create or replace function public.complete_job_and_prepare_invoice(p_job_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_job public.jobs%rowtype; v_invoice_id uuid;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode='42501'; end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found or v_job.status not in ('SCHEDULED','IN_PROGRESS','COMPLETED') then raise exception 'Job cannot be completed'; end if;
  if v_job.status <> 'COMPLETED' then
    update public.jobs set status='COMPLETED',completed_at=coalesce(completed_at,now()),updated_at=now() where id=p_job_id;
    insert into public.activity_history (customer_id,entity_type,entity_id,event_type,summary,actor_label)
      values (v_job.customer_id,'JOB',v_job.id,'COMPLETED','Job completed',coalesce(auth.jwt()->>'email',auth.uid()::text));
  end if;
  v_invoice_id := public.create_invoice_from_job(p_job_id);
  return v_invoice_id;
end;
$$;

-- Future manual payments identify their source without rewriting legacy rows.
create or replace function public.record_invoice_payment_full(
  p_invoice_id uuid, p_method text, p_received_at timestamptz, p_note text default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_invoice public.invoices%rowtype; v_paid numeric; v_outstanding numeric; v_id uuid;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode='42501'; end if;
  if p_method not in ('ACH','CARD','ZELLE','APPLE_PAY','CHECK','OTHER') then raise exception 'Unsupported manual payment method'; end if;
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found or v_invoice.status in ('PAID','VOID') then raise exception 'Invoice is not eligible for payment'; end if;
  select coalesce(sum(amount),0) into v_paid from public.payments where invoice_id=p_invoice_id and voided_at is null;
  v_outstanding := round(v_invoice.amount-v_paid,2);
  if v_outstanding <= 0 then raise exception 'Invoice has no outstanding balance'; end if;
  insert into public.payments (invoice_id,customer_id,amount,method,confirmed_by,note,received_at,payment_source)
    values (v_invoice.id,v_invoice.customer_id,v_outstanding,p_method,'HUMAN',nullif(trim(p_note),''),coalesce(p_received_at,now()),'MANUAL')
    returning id into v_id;
  perform set_config('app.financial_safe_write','true',true);
  update public.invoices set status='PAID',paid_at=coalesce(p_received_at,now()),updated_at=now() where id=p_invoice_id;
  insert into public.financial_history (record_type,record_id,event_type,reason,after_snapshot,actor_label)
    values ('PAYMENT',v_id,'RECORDED','Full outstanding balance recorded',jsonb_build_object('amount',v_outstanding,'method',p_method,'source','MANUAL'),coalesce(auth.jwt()->>'email',auth.uid()::text));
  insert into public.activity_history (customer_id,entity_type,entity_id,event_type,summary,metadata,actor_label)
    values (v_invoice.customer_id,'PAYMENT',v_id,'RECORDED','Full payment recorded for invoice '||v_invoice.invoice_number,
      jsonb_build_object('amount',v_outstanding,'invoice_id',v_invoice.id),coalesce(auth.jwt()->>'email',auth.uid()::text));
  update public.customers set last_activity_at=now() where id=v_invoice.customer_id;
  return v_id;
end;
$$;

revoke all on function public.reserve_stripe_checkout_session(uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function public.activate_stripe_checkout_session(uuid,text,text,timestamptz,boolean) from public,anon,authenticated;
revoke all on function public.fail_stripe_checkout_session(uuid,text) from public,anon,authenticated;
revoke all on function public.process_stripe_checkout_payment(text,text,text,text,bigint,text,boolean,text,timestamptz) from public,anon,authenticated;
revoke all on function public.mark_stripe_checkout_terminal(text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.reserve_stripe_checkout_session(uuid,uuid,bigint) to service_role;
grant execute on function public.activate_stripe_checkout_session(uuid,text,text,timestamptz,boolean) to service_role;
grant execute on function public.fail_stripe_checkout_session(uuid,text) to service_role;
grant execute on function public.process_stripe_checkout_payment(text,text,text,text,bigint,text,boolean,text,timestamptz) to service_role;
grant execute on function public.mark_stripe_checkout_terminal(text,text,text,text,boolean) to service_role;

revoke all on function public.revise_draft_invoice(uuid,numeric,text,text) from public,anon;
revoke all on function public.complete_job_and_prepare_invoice(uuid) from public,anon;
grant execute on function public.revise_draft_invoice(uuid,numeric,text,text) to authenticated;
grant execute on function public.complete_job_and_prepare_invoice(uuid) to authenticated;
