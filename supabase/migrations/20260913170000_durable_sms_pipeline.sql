-- Additive transport upgrade. No readiness promotion or historical sends.
begin;

alter table public.control_center_settings
  add column if not exists ai_english boolean not null default true,
  add column if not exists ai_spanish boolean not null default true,
  add column if not exists human_takeover_on_reply boolean not null default true;
alter table public.leads add column if not exists conversation_revision bigint not null default 0;
alter table public.customers
  add column if not exists sms_consent_updated_at timestamptz,
  add column if not exists sms_opt_in_requested_at timestamptz,
  add column if not exists sms_opt_in_request_message_id uuid,
  add column if not exists sms_marketing_consent_at timestamptz;

create table public.communication_runtime (
  id integer primary key check (id = 1),
  test_numbers text[] not null default array['+12143568256'],
  ai_sending_enabled boolean not null default false,
  scheduled_sending_enabled boolean not null default false,
  marketing_approved boolean not null default false,
  activated_at timestamptz,
  timezone text not null default 'America/Chicago',
  updated_at timestamptz not null default now()
);
insert into public.communication_runtime (id) values (1);

create table public.sms_outbox (
  message_id uuid primary key references public.lead_messages(id) on delete restrict,
  operation_key text not null unique,
  origin text not null check (origin in ('HUMAN','AI','AUTOMATION','OPT_IN')),
  payload jsonb not null,
  conversation_revision bigint not null,
  trigger_message_id uuid references public.lead_messages(id) on delete restrict,
  guard jsonb not null default '{}',
  state text not null default 'QUEUED'
    check (state in ('QUEUED','LEASED','DISPATCHING','RETRY','ACCEPTED','FAILED','REVIEW','CANCELLED')),
  attempts integer not null default 0,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  expires_at timestamptz not null default (now() + interval '23 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sms_outbox_due_idx on public.sms_outbox (next_attempt_at) where state in ('QUEUED','RETRY','LEASED','DISPATCHING');

create table public.communication_jobs (
  id uuid primary key default gen_random_uuid(),
  operation_key text not null unique,
  kind text not null check (kind in ('AI_REPLY','AUTOMATION')),
  lead_id uuid not null references public.leads(id) on delete restrict,
  trigger_message_id uuid references public.lead_messages(id) on delete restrict,
  rule_id text references public.automation_rules(id) on delete restrict,
  context jsonb not null default '{}',
  state text not null default 'QUEUED' check (state in ('QUEUED','WORKING','DONE','CANCELLED','FAILED')),
  attempts integer not null default 0,
  due_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index communication_jobs_due_idx on public.communication_jobs (due_at) where state in ('QUEUED','WORKING');

do $$ declare t text; begin
  foreach t in array array['communication_runtime','sms_outbox','communication_jobs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy staff_read on public.%I for select to authenticated using (public.is_admin_or_staff())', t);
    execute format('revoke all on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

alter table public.sms_webhook_events drop constraint sms_webhook_events_processing_status_check;
alter table public.sms_webhook_events add constraint sms_webhook_events_processing_status_check
  check (processing_status in ('PROCESSING','PROCESSED','IGNORED','FAILED','UNMATCHED'));
alter table public.sms_webhook_events add column if not exists occurred_at timestamptz;

-- Ordered delivery transitions. A delayed SENT cannot overwrite FAILED or DELIVERED.
-- Positive delivery evidence wins over failure; never turn DELIVERED into FAILED.
create or replace function public.apply_sms_delivery_status(p_provider_message_id text, p_provider_status text, p_error_message text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare m public.lead_messages%rowtype; s text := upper(trim(p_provider_status)); ranks jsonb :=
  '{"PENDING":0,"QUEUED":10,"ROUTED":20,"SCHEDULED":25,"SENT":30,"FAILED":40,"FILTERED":40,"BLOCKED":40,"DELIVERED":50,"READ":60}';
begin
  if not ranks ? s then raise exception 'Unsupported sent.DM message status'; end if;
  select * into m from public.lead_messages where provider='SENT_DM' and provider_message_id=p_provider_message_id for update;
  if not found then return null; end if;
  if coalesce((ranks->>s)::int,0) >= coalesce((ranks->>m.delivery_status)::int,0) then
    update public.lead_messages set delivery_status=s, provider_status=s,
      send_error=case when s in ('FAILED','FILTERED','BLOCKED') then coalesce(nullif(p_error_message,''),'Provider reported ' || s) else null end,
      sent_at=case when s in ('SENT','DELIVERED','READ') then coalesce(sent_at,now()) else sent_at end,
      delivered_at=case when s in ('DELIVERED','READ') then coalesce(delivered_at,now()) else delivered_at end,
      failed_at=case when s in ('FAILED','FILTERED','BLOCKED') then coalesce(failed_at,now()) when s in ('DELIVERED','READ') then null else failed_at end,
      updated_at=now() where id=m.id returning * into m;
  end if;
  return jsonb_build_object('message_id',m.id,'lead_id',m.lead_id,'customer_id',m.customer_id,'delivery_status',m.delivery_status);
end $$;

-- All origins reserve one immutable payload and permanent operation identity.
create function public.enqueue_sms(
  p_lead_id uuid, p_body text, p_operation_key text, p_origin text,
  p_actor_id uuid default null, p_template_id text default null,
  p_trigger_message_id uuid default null, p_rule_id text default null, p_guard jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare l public.leads%rowtype; c public.customers%rowtype; m public.lead_messages%rowtype;
  r public.communication_runtime%rowtype; s public.control_center_settings%rowtype;
  digits text; dest text; payload jsonb; inbound boolean; kind text;
begin
  if p_origin not in ('HUMAN','AI','AUTOMATION','OPT_IN') or nullif(trim(p_body),'') is null or length(trim(p_body))>1600
    or nullif(p_operation_key,'') is null or length(p_operation_key)>240 then raise exception 'Invalid SMS reservation'; end if;
  perform pg_advisory_xact_lock(hashtextextended('sms-operation:' || p_operation_key,0));
  select * into m from public.lead_messages where idempotency_key=p_operation_key;
  if found then
    if m.lead_id<>p_lead_id or m.body<>trim(p_body) then raise exception 'Operation already reserved with different content'; end if;
    return to_jsonb(m);
  end if;
  select * into l from public.leads where id=p_lead_id;
  if not found then raise exception 'Lead not found'; end if;
  select * into c from public.customers where id=l.customer_id for update;
  select * into l from public.leads where id=p_lead_id for update;
  select * into s from public.control_center_settings where id=1;
  select * into r from public.communication_runtime where id=1;
  digits:=regexp_replace(coalesce(c.phone,''),'[^0-9]','','g');
  dest:=case when length(digits)=10 then '+1'||digits when length(digits)=11 and left(digits,1)='1' then '+'||digits else null end;
  if dest is null then raise exception 'A valid US customer phone is required'; end if;
  if s.id is null or s.sms_status not in ('READY','TESTING') or s.business_number is distinct from '+19453750877' or r.id is null then raise exception 'SMS is not ready'; end if;
  if s.sms_status='TESTING' and not dest=any(r.test_numbers) then raise exception 'SMS testing is restricted to approved test numbers'; end if;
  if c.sms_opted_out_at is not null then raise exception 'Customer has opted out of SMS'; end if;
  select exists(select 1 from public.lead_messages where customer_id=c.id and sender_type='CUSTOMER' and message_kind='INBOUND') into inbound;
  if c.sms_consent_at is null and not inbound then raise exception 'Customer SMS consent is not recorded'; end if;
  if p_origin in ('HUMAN','OPT_IN') and not exists(select 1 from public.user_roles where user_id=p_actor_id and role in ('admin','staff')) then raise exception 'Staff actor required'; end if;
  if p_origin in ('AI','AUTOMATION') then
    if c.sms_consent_at is null or c.sms_double_opt_in_at is null then raise exception 'Customer has not completed SMS double opt in'; end if;
    if l.human_takeover then raise exception 'Human takeover is active'; end if;
    if p_origin='AI' and (not r.ai_sending_enabled or p_trigger_message_id is null) then raise exception 'AI sending is disabled'; end if;
    if p_origin='AUTOMATION' and (not r.scheduled_sending_enabled or not exists(select 1 from public.automation_rules where id=p_rule_id and status='ON')) then raise exception 'Scheduled sending is disabled'; end if;
    if p_rule_id in ('review-request','reactivation') and (not r.marketing_approved or c.sms_marketing_consent_at is null) then raise exception 'Campaign coverage or marketing consent is not verified'; end if;
    if p_trigger_message_id is not null and p_trigger_message_id is distinct from
      (select id from public.lead_messages where lead_id=l.id and sender_type='CUSTOMER' order by created_at desc,id desc limit 1) then raise exception 'Conversation changed'; end if;
  end if;
  if p_origin='OPT_IN' and (c.sms_consent_at is null or c.sms_double_opt_in_at is not null) then raise exception 'Opt in request is not eligible'; end if;
  if p_origin='OPT_IN' and exists(select 1 from public.sms_outbox o join public.lead_messages lm on lm.id=o.message_id
    where lm.customer_id=c.id and o.origin='OPT_IN' and o.state not in ('FAILED','CANCELLED') and o.created_at>now()-interval '7 days') then raise exception 'An SMS confirmation request is already pending'; end if;
  kind:=case when inbound and p_origin<>'OPT_IN' then 'FREEFORM' else 'TEMPLATE' end;
  if kind='TEMPLATE' and nullif(p_template_id,'') is null then raise exception 'Approved first contact template is missing'; end if;
  payload:=jsonb_build_object('to',jsonb_build_array(dest),'channel',jsonb_build_array('sms')) ||
    case when kind='FREEFORM' then jsonb_build_object('text',trim(p_body)) else
    jsonb_build_object('template',jsonb_build_object('id',p_template_id,'parameters',jsonb_build_object('message',trim(p_body)))) end;
  if p_origin in ('HUMAN','OPT_IN') then
    update public.leads set human_takeover=true,conversation_revision=conversation_revision+1,updated_at=now() where id=l.id returning * into l;
    update public.communication_jobs set state='CANCELLED',last_error='Human takeover',updated_at=now() where lead_id=l.id and state in ('QUEUED','WORKING');
    update public.sms_outbox o set state='CANCELLED',last_error='Human takeover',updated_at=now()
      from public.lead_messages lm where o.message_id=lm.id and lm.lead_id=l.id and o.origin in ('AI','AUTOMATION') and o.state in ('QUEUED','RETRY','LEASED');
  end if;
  insert into public.lead_messages(lead_id,customer_id,sender_type,body,delivery_status,provider,provider_status,message_kind,provider_template_id,idempotency_key,automation_rule_id,created_by)
    values(l.id,c.id,case when p_origin in ('AI','AUTOMATION') then 'AI' else 'HUMAN' end,trim(p_body),'PENDING','SENT_DM','PENDING',kind,case when kind='TEMPLATE' then p_template_id end,p_operation_key,p_rule_id,p_actor_id) returning * into m;
  insert into public.sms_outbox(message_id,operation_key,origin,payload,conversation_revision,trigger_message_id,guard)
    values(m.id,p_operation_key,p_origin,payload,l.conversation_revision,p_trigger_message_id,p_guard);
  insert into public.activity_history(customer_id,entity_type,entity_id,event_type,summary,actor_id,actor_label,metadata)
    values(c.id,'LEAD',l.id,'SMS_RESERVED','SMS reserved for sent.DM delivery',p_actor_id,p_origin,jsonb_build_object('message_id',m.id,'origin',p_origin));
  return to_jsonb(m);
end $$;

-- Claim leases, never send twice concurrently. Expired dispatches are ambiguous,
-- not failed. Retry only the same payload/key inside a conservative 23h window.
create function public.claim_sms(p_message_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.sms_outbox%rowtype;
begin
  update public.sms_outbox set state='REVIEW',last_error='Submission requires reconciliation; automatic retry window exhausted',updated_at=now()
    where state in ('QUEUED','RETRY','LEASED','DISPATCHING') and (lease_until is null or lease_until<now())
      and (expires_at<=now() or attempts>=3 or first_attempt_at<now()-interval '23 hours');
  select * into o from public.sms_outbox
    where (p_message_id is null or message_id=p_message_id) and next_attempt_at<=now() and expires_at>now() and attempts<3
      and (state in ('QUEUED','RETRY') or (state in ('LEASED','DISPATCHING') and lease_until<now()))
    order by next_attempt_at,created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.sms_outbox set state='LEASED',lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',updated_at=now()
    where message_id=o.message_id returning * into o;
  return to_jsonb(o);
end $$;

-- Last preflight immediately before the provider request. Same customer lock
-- as inbound consent updates; no separate browser-only safety decisions.
create function public.authorize_sms_dispatch(p_message_id uuid,p_lease_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.sms_outbox%rowtype; m public.lead_messages%rowtype; c public.customers%rowtype; l public.leads%rowtype;
  r public.communication_runtime%rowtype; s public.control_center_settings%rowtype; reason text;
begin
  select * into m from public.lead_messages where id=p_message_id;
  select * into c from public.customers where id=m.customer_id for update;
  select * into l from public.leads where id=m.lead_id for update;
  select * into o from public.sms_outbox where message_id=p_message_id for update;
  if o.state<>'LEASED' or o.lease_token is distinct from p_lease_token or o.lease_until<now() then return null; end if;
  select * into s from public.control_center_settings where id=1;
  select * into r from public.communication_runtime where id=1;
  reason:=case
    when m.provider_message_id is not null then 'Already linked to provider'
    when s.id is null or r.id is null or s.sms_status not in ('READY','TESTING') or s.business_number is distinct from '+19453750877' then 'SMS sending is disabled'
    when s.sms_status='TESTING' and not (o.payload->'to'->>0)=any(r.test_numbers) then 'Not an approved test number'
    when c.sms_opted_out_at is not null then 'Customer has opted out'
    when c.phone is null or regexp_replace(c.phone,'[^0-9]','','g') not in (right(o.payload->'to'->>0,10),right(o.payload->'to'->>0,11)) then 'Customer phone changed'
    when o.origin in ('AI','AUTOMATION') and (c.sms_consent_at is null or c.sms_double_opt_in_at is null) then 'Double opt in is missing'
    when o.origin in ('AI','AUTOMATION') and (l.human_takeover or o.conversation_revision<>l.conversation_revision) then 'Conversation changed or human takeover'
    when o.origin='AI' and not r.ai_sending_enabled then 'AI sending is disabled'
    when o.origin='AUTOMATION' and (not r.scheduled_sending_enabled or not exists(select 1 from public.automation_rules where id=m.automation_rule_id and status='ON')) then 'Scheduled sending is disabled'
    when m.automation_rule_id in ('reactivation','review-request') and not r.marketing_approved then 'Campaign coverage is not verified'
    when o.origin='AUTOMATION' and not coalesce(public.sms_automation_guard(m.automation_rule_id,l.id,o.guard),false) then 'Scheduled record changed'
    when o.origin='AUTOMATION' and public.sms_business_time(now())>now() then 'Outside business messaging hours'
    when o.origin='AI' and (select count(*) from public.sms_outbox other join public.lead_messages lm on lm.id=other.message_id
      where lm.customer_id=c.id and other.message_id<>m.id and other.origin='AI' and other.state in ('DISPATCHING','ACCEPTED','RETRY','REVIEW') and other.first_attempt_at>now()-interval '1 hour')>=6 then 'Conversation rate limit reached'
    when o.origin='AUTOMATION' and (select count(*) from public.sms_outbox other join public.lead_messages lm on lm.id=other.message_id
      where lm.customer_id=c.id and other.message_id<>m.id and other.origin='AUTOMATION' and other.state in ('DISPATCHING','ACCEPTED','RETRY','REVIEW') and other.first_attempt_at>now()-interval '30 days')>=8 then 'Monthly follow up limit reached'
    when o.expires_at<=now() then 'Message expired'
    else null end;
  if reason is not null then
    update public.sms_outbox set state='CANCELLED',last_error=reason,updated_at=now() where message_id=m.id;
    update public.lead_messages set provider_status='CANCELLED',delivery_status='BLOCKED',send_error=reason,updated_at=now() where id=m.id;
    return null;
  end if;
  update public.sms_outbox set state='DISPATCHING',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),updated_at=now()
    where message_id=m.id returning * into o;
  return to_jsonb(o);
end $$;

create function public.complete_sms_dispatch(p_message_id uuid,p_lease_token uuid,p_provider_message_id text,p_status text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.sms_outbox%rowtype; e public.sms_webhook_events%rowtype; result jsonb; m public.lead_messages%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('sms-provider:'||p_provider_message_id,0));
  select * into m from public.lead_messages where id=p_message_id;
  perform 1 from public.customers where id=m.customer_id for update;
  perform 1 from public.leads where id=m.lead_id for update;
  select * into o from public.sms_outbox where message_id=p_message_id for update;
  if o.lease_token is distinct from p_lease_token or o.state<>'DISPATCHING' then raise exception 'SMS dispatch lease lost'; end if;
  if nullif(trim(p_provider_message_id),'') is null then raise exception 'Provider message id required'; end if;
  update public.lead_messages set provider_message_id=p_provider_message_id,updated_at=now() where id=p_message_id and provider_message_id is null;
  result:=public.apply_sms_delivery_status(p_provider_message_id,p_status,null);
  update public.sms_outbox set state='ACCEPTED',lease_until=null,last_error=null,updated_at=now() where message_id=p_message_id;
  if o.origin='OPT_IN' then
    update public.customers set sms_opt_in_requested_at=now(),sms_opt_in_request_message_id=p_message_id
      where id=(select customer_id from public.lead_messages where id=p_message_id) and sms_opted_out_at is null;
  end if;
  for e in select * from public.sms_webhook_events where provider_message_id=p_provider_message_id and processing_status='UNMATCHED' order by occurred_at,received_at loop
    result:=public.apply_sms_delivery_status(p_provider_message_id,e.message_status,e.error_message);
    update public.sms_webhook_events set processing_status='PROCESSED',processed_at=now(),updated_at=now() where event_key=e.event_key;
  end loop;
  return result;
end $$;

create function public.fail_sms_dispatch(p_message_id uuid,p_lease_token uuid,p_retryable boolean,p_error text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.sms_outbox%rowtype;
begin
  select * into o from public.sms_outbox where message_id=p_message_id for update;
  if o.lease_token is distinct from p_lease_token or o.state<>'DISPATCHING' then return; end if;
  update public.sms_outbox set state=case when not p_retryable then 'FAILED' when attempts>=3 then 'REVIEW' else 'RETRY' end,
    next_attempt_at=now()+interval '2 minutes'*greatest(attempts,1),lease_until=null,last_error=left(p_error,500),updated_at=now()
    where message_id=p_message_id;
  update public.lead_messages set delivery_status=case when p_retryable then 'PENDING' else 'FAILED' end,
    provider_status=case when p_retryable then 'SUBMISSION_UNCONFIRMED' else 'REQUEST_REJECTED' end,
    send_error=left(p_error,500),updated_at=now() where id=p_message_id and provider_message_id is null;
end $$;

-- Frozen payloads cannot be altered after reservation, including by future code.
create function public.protect_sms_payload() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.payload is distinct from old.payload or new.operation_key<>old.operation_key or new.origin<>old.origin
    or new.conversation_revision<>old.conversation_revision or new.trigger_message_id is distinct from old.trigger_message_id
    or new.guard is distinct from old.guard then raise exception 'Reserved SMS payload is immutable'; end if;
  return new;
end $$;
create trigger protect_sms_payload before update on public.sms_outbox for each row execute function public.protect_sms_payload();

-- Service-only RPCs. Staff uses authenticated Edge Functions, not direct writes.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('enqueue_sms','claim_sms','authorize_sms_dispatch','complete_sms_dispatch','fail_sms_dispatch','protect_sms_payload') loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
