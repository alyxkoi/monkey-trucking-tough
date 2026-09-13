-- sent.DM SMS transport foundation.
-- The approved number is recorded, but readiness remains gated until real
-- outbound, inbound, delivery, opt-out, and retry traffic passes end to end.

begin;

alter table public.control_center_settings
  drop constraint if exists control_center_settings_sms_status_check;
alter table public.control_center_settings
  add constraint control_center_settings_sms_status_check
  check (sms_status in ('READY','TESTING','SETUP_REQUIRED','OFF'));

update public.control_center_settings
set business_number = '+19453750877',
    sms_status = 'SETUP_REQUIRED',
    calling_status = 'SETUP_REQUIRED',
    updated_at = now()
where id = 1;

alter table public.customers
  add column if not exists sms_double_opt_in_at timestamptz,
  add column if not exists sms_opt_out_source text;

comment on column public.customers.sms_consent_at is
  'First-party SMS consent captured by Monkey Trucking. This alone is not the double opt-in confirmation.';
comment on column public.customers.sms_double_opt_in_at is
  'Second affirmative SMS opt-in, normally received as START through sent.DM.';
comment on column public.customers.sms_opt_out_source is
  'Source of the current opt-out, such as SENT_DM_STOP.';

alter table public.lead_messages
  drop constraint if exists lead_messages_delivery_status_check;
alter table public.lead_messages
  add constraint lead_messages_delivery_status_check check (
    delivery_status in (
      'INTERNAL','PENDING','QUEUED','ROUTED','SCHEDULED','SENT',
      'DELIVERED','READ','FAILED','FILTERED','BLOCKED','RECEIVED'
    )
  );

alter table public.lead_messages
  add column if not exists provider text,
  add column if not exists provider_status text,
  add column if not exists message_kind text,
  add column if not exists provider_template_id text,
  add column if not exists idempotency_key text,
  add column if not exists automation_rule_id text references public.automation_rules(id) on delete restrict,
  add column if not exists send_error text,
  add column if not exists sent_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.lead_messages
  drop constraint if exists lead_messages_provider_check;
alter table public.lead_messages
  add constraint lead_messages_provider_check
  check (provider is null or provider = 'SENT_DM');
alter table public.lead_messages
  drop constraint if exists lead_messages_message_kind_check;
alter table public.lead_messages
  add constraint lead_messages_message_kind_check
  check (message_kind is null or message_kind in ('FREEFORM','TEMPLATE','INBOUND','COMPLIANCE'));

create unique index if not exists lead_messages_provider_message_unique
  on public.lead_messages (provider, provider_message_id)
  where provider is not null and provider_message_id is not null;
create unique index if not exists lead_messages_idempotency_unique
  on public.lead_messages (idempotency_key)
  where idempotency_key is not null;
create index if not exists lead_messages_provider_status_idx
  on public.lead_messages (provider, provider_status, updated_at desc);

-- Provider truth is written only through authenticated Edge Functions. Staff
-- can read the conversation but cannot forge delivery states in the browser.
drop policy if exists control_center_insert on public.lead_messages;
drop policy if exists control_center_update on public.lead_messages;
revoke insert, update, delete on public.lead_messages from authenticated, anon;
grant select on public.lead_messages to authenticated;

create table if not exists public.sms_webhook_events (
  event_key text primary key,
  provider text not null default 'SENT_DM' check (provider = 'SENT_DM'),
  provider_message_id text not null,
  event_type text not null,
  message_status text not null,
  processing_status text not null default 'PROCESSING'
    check (processing_status in ('PROCESSING','PROCESSED','IGNORED','FAILED')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists sms_webhook_events_message_idx
  on public.sms_webhook_events (provider_message_id, received_at desc);

create table if not exists public.sms_consent_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  provider_message_id text not null unique,
  event_type text not null check (event_type in ('OPT_IN','OPT_OUT','HELP')),
  keyword text not null,
  source text not null default 'SENT_DM',
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sms_consent_events_customer_idx
  on public.sms_consent_events (customer_id, occurred_at desc);

alter table public.sms_webhook_events enable row level security;
alter table public.sms_consent_events enable row level security;
drop policy if exists sms_webhook_events_staff_read on public.sms_webhook_events;
create policy sms_webhook_events_staff_read on public.sms_webhook_events
  for select to authenticated using (public.is_admin_or_staff());
drop policy if exists sms_consent_events_staff_read on public.sms_consent_events;
create policy sms_consent_events_staff_read on public.sms_consent_events
  for select to authenticated using (public.is_admin_or_staff());
grant select on public.sms_webhook_events, public.sms_consent_events to authenticated;
grant all on public.sms_webhook_events, public.sms_consent_events to service_role;
revoke insert, update, delete on public.sms_webhook_events, public.sms_consent_events from authenticated, anon;

-- Public form consent is attached to the customer created by the existing
-- contact-submission trigger. It remains first-step consent until START arrives.
create or replace function public.sync_contact_submission_sms_consent()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.sms_consent and new.customer_id is not null then
    update public.customers
    set sms_consent_at = coalesce(sms_consent_at, new.sms_consent_at, new.submitted_at),
        sms_consent_source = coalesce(sms_consent_source, new.consent_source),
        updated_at = now()
    where id = new.customer_id and sms_opted_out_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_contact_submission_sms_consent on public.contact_submissions;
create trigger sync_contact_submission_sms_consent
after insert on public.contact_submissions
for each row execute function public.sync_contact_submission_sms_consent();

revoke all on function public.sync_contact_submission_sms_consent() from public, anon, authenticated;

update public.customers c
set sms_consent_at = coalesce(c.sms_consent_at, s.sms_consent_at),
    sms_consent_source = coalesce(c.sms_consent_source, s.consent_source),
    updated_at = now()
from (
  select distinct on (customer_id) customer_id, sms_consent_at, consent_source
  from public.contact_submissions
  where customer_id is not null and sms_consent and sms_consent_at is not null
  order by customer_id, sms_consent_at desc
) s
where c.id = s.customer_id and c.sms_consent_at is null;

-- The Edge Function calls this service-only routine after authenticating the
-- staff user. Reservation, human takeover, and the audit row are one transaction.
create or replace function public.reserve_manual_sms(
  p_lead_id uuid,
  p_body text,
  p_idempotency_key text,
  p_actor_id uuid,
  p_message_kind text,
  p_template_id text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_lead public.leads%rowtype;
  v_customer public.customers%rowtype;
  v_message public.lead_messages%rowtype;
  v_status text;
  v_has_inbound boolean;
begin
  if nullif(trim(p_body), '') is null or length(trim(p_body)) > 1600 then
    raise exception 'Enter a message between 1 and 1600 characters' using errcode = '22023';
  end if;
  if p_message_kind not in ('FREEFORM','TEMPLATE') then
    raise exception 'Unsupported SMS message kind' using errcode = '22023';
  end if;

  select sms_status into v_status
  from public.control_center_settings where id = 1 for update;
  if v_status not in ('READY','TESTING') then
    raise exception 'SMS is not ready for provider traffic' using errcode = '55000';
  end if;

  select * into v_message
  from public.lead_messages where idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_message); end if;

  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then raise exception 'Lead not found' using errcode = 'P0002'; end if;
  select * into v_customer from public.customers where id = v_lead.customer_id for update;
  if not found then raise exception 'Customer not found' using errcode = 'P0002'; end if;

  -- A second browser request can pass the optimistic check while the first is
  -- still committing. Recheck after the per-lead lock to make that race safe.
  select * into v_message
  from public.lead_messages where idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_message); end if;

  if v_customer.sms_opted_out_at is not null then
    raise exception 'Customer has opted out of SMS' using errcode = '42501';
  end if;
  if nullif(trim(v_customer.phone), '') is null then
    raise exception 'Customer phone number is missing' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.lead_messages
    where customer_id = v_customer.id and sender_type = 'CUSTOMER'
      and delivery_status = 'RECEIVED' and message_kind = 'INBOUND'
  ) into v_has_inbound;
  if v_customer.sms_consent_at is null and not v_has_inbound then
    raise exception 'Customer SMS consent is not recorded' using errcode = '42501';
  end if;

  insert into public.lead_messages (
    lead_id, customer_id, sender_type, body, delivery_status,
    provider, provider_status, message_kind, provider_template_id,
    idempotency_key, created_by
  ) values (
    v_lead.id, v_customer.id, 'HUMAN', trim(p_body), 'PENDING',
    'SENT_DM', 'PENDING', p_message_kind, nullif(trim(p_template_id), ''),
    p_idempotency_key, p_actor_id
  ) returning * into v_message;

  update public.leads
  set human_takeover = true, last_contact_at = now(), updated_at = now()
  where id = v_lead.id;

  insert into public.activity_history (
    customer_id, entity_type, entity_id, event_type, summary, actor_id, actor_label,
    metadata
  ) values (
    v_customer.id, 'LEAD', v_lead.id, 'SMS_RESERVED',
    'Staff SMS reserved for sent.DM delivery', p_actor_id, 'Dashboard staff',
    jsonb_build_object('message_id', v_message.id, 'message_kind', p_message_kind)
  );
  return to_jsonb(v_message);
end;
$$;

revoke all on function public.reserve_manual_sms(uuid,text,text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.reserve_manual_sms(uuid,text,text,uuid,text,text) to service_role;

-- Resolve an inbound number under an advisory lock. Unknown numbers become a
-- safe customer and lead instead of being discarded.
create or replace function public.resolve_inbound_sms_conversation(p_phone text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_normalized text;
  v_e164 text;
  v_customer public.customers%rowtype;
  v_lead public.leads%rowtype;
  v_created boolean := false;
begin
  if length(v_digits) = 11 and left(v_digits, 1) = '1' then
    v_normalized := right(v_digits, 10);
    v_e164 := '+' || v_digits;
  elsif length(v_digits) = 10 then
    v_normalized := v_digits;
    v_e164 := '+1' || v_digits;
  else
    raise exception 'Inbound phone must be a US E.164 number' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('inbound-sms:' || v_normalized, 0));
  select * into v_customer from public.customers
  where normalized_phone in (v_normalized, '1' || v_normalized)
  order by last_activity_at desc limit 1 for update;

  if not found then
    insert into public.customers (name, phone, normalized_phone, last_activity_at)
    values ('Unknown SMS ' || v_e164, v_e164, v_normalized, now())
    returning * into v_customer;
    v_created := true;
  else
    update public.customers set last_activity_at = now(), updated_at = now()
    where id = v_customer.id returning * into v_customer;
  end if;

  select * into v_lead from public.leads
  where customer_id = v_customer.id
  order by case when status in ('NEW','ACTIVE','QUOTED') then 0 else 1 end,
           updated_at desc
  limit 1 for update;

  if not found then
    insert into public.leads (customer_id, status, source, need)
    values (v_customer.id, 'NEW', 'Other', 'Inbound SMS conversation')
    returning * into v_lead;
    insert into public.activity_history (
      customer_id, entity_type, entity_id, event_type, summary, actor_label
    ) values (
      v_customer.id, 'LEAD', v_lead.id, 'CREATED',
      'Lead created from an inbound SMS', 'sent.DM webhook'
    );
  end if;

  return jsonb_build_object(
    'customer_id', v_customer.id,
    'lead_id', v_lead.id,
    'customer_created', v_created
  );
end;
$$;

revoke all on function public.resolve_inbound_sms_conversation(text) from public, anon, authenticated;
grant execute on function public.resolve_inbound_sms_conversation(text) to service_role;

create or replace function public.record_inbound_sms(
  p_provider_message_id text,
  p_phone text,
  p_body text,
  p_keyword text default null,
  p_received_at timestamptz default now()
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_conversation jsonb;
  v_customer_id uuid;
  v_lead_id uuid;
  v_message public.lead_messages%rowtype;
  v_inserted boolean := false;
  v_keyword text := nullif(upper(trim(coalesce(p_keyword, ''))), '');
begin
  if nullif(trim(p_provider_message_id), '') is null then
    raise exception 'Provider message id is required' using errcode = '22023';
  end if;
  if nullif(trim(p_body), '') is null then
    raise exception 'Inbound message body is required' using errcode = '22023';
  end if;
  if v_keyword is not null and v_keyword not in ('STOP','START','HELP') then
    raise exception 'Unsupported compliance keyword' using errcode = '22023';
  end if;

  select * into v_message from public.lead_messages
  where provider = 'SENT_DM' and provider_message_id = trim(p_provider_message_id);
  if found then
    return jsonb_build_object(
      'message_id', v_message.id,
      'customer_id', v_message.customer_id,
      'lead_id', v_message.lead_id,
      'inserted', false
    );
  end if;

  v_conversation := public.resolve_inbound_sms_conversation(p_phone);
  v_customer_id := (v_conversation->>'customer_id')::uuid;
  v_lead_id := (v_conversation->>'lead_id')::uuid;

  if v_keyword = 'STOP' then
    update public.customers set
      sms_opted_out_at = coalesce(sms_opted_out_at, p_received_at),
      sms_opt_out_source = 'SENT_DM_STOP',
      updated_at = now()
    where id = v_customer_id;
  elsif v_keyword = 'START' then
    update public.customers set
      sms_consent_at = coalesce(sms_consent_at, p_received_at),
      sms_consent_source = coalesce(sms_consent_source, 'SENT_DM_START'),
      sms_double_opt_in_at = p_received_at,
      sms_opted_out_at = null,
      sms_opt_out_source = null,
      updated_at = now()
    where id = v_customer_id;
  end if;

  insert into public.lead_messages (
    lead_id, customer_id, sender_type, body, delivery_status,
    provider, provider_status, provider_message_id, message_kind,
    created_at, updated_at
  ) values (
    v_lead_id, v_customer_id, 'CUSTOMER', left(trim(p_body), 1600), 'RECEIVED',
    'SENT_DM', 'RECEIVED', trim(p_provider_message_id),
    case when v_keyword is null then 'INBOUND' else 'COMPLIANCE' end,
    p_received_at, now()
  )
  on conflict (provider, provider_message_id)
    where provider is not null and provider_message_id is not null
  do nothing
  returning * into v_message;
  v_inserted := found;

  if not v_inserted then
    select * into v_message from public.lead_messages
    where provider = 'SENT_DM' and provider_message_id = trim(p_provider_message_id);
  end if;

  update public.leads set last_contact_at = p_received_at, updated_at = now()
  where id = v_lead_id;

  if v_inserted then
    if v_keyword is not null then
      insert into public.sms_consent_events (
        customer_id, provider_message_id, event_type, keyword, occurred_at
      ) values (
        v_customer_id, trim(p_provider_message_id),
        case v_keyword when 'STOP' then 'OPT_OUT' when 'START' then 'OPT_IN' else 'HELP' end,
        v_keyword, p_received_at
      ) on conflict (provider_message_id) do nothing;
    end if;
    insert into public.activity_history (
      customer_id, entity_type, entity_id, event_type, summary, actor_label, metadata
    ) values (
      v_customer_id, 'LEAD', v_lead_id,
      case when v_keyword is null then 'SMS_RECEIVED' else 'SMS_' || v_keyword end,
      case when v_keyword is null then 'Customer SMS received' else 'Customer sent ' || v_keyword end,
      'sent.DM webhook', jsonb_build_object('provider_message_id', p_provider_message_id)
    );
  end if;

  return jsonb_build_object(
    'message_id', v_message.id,
    'customer_id', v_customer_id,
    'lead_id', v_lead_id,
    'inserted', v_inserted
  );
end;
$$;

revoke all on function public.record_inbound_sms(text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_inbound_sms(text,text,text,text,timestamptz) to service_role;

create or replace function public.apply_sms_delivery_status(
  p_provider_message_id text,
  p_provider_status text,
  p_error_message text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_message public.lead_messages%rowtype;
  v_status text := upper(trim(p_provider_status));
  v_current_rank integer;
  v_next_rank integer;
begin
  if v_status not in ('PENDING','QUEUED','ROUTED','SCHEDULED','SENT','DELIVERED','READ','FAILED','FILTERED','BLOCKED') then
    raise exception 'Unsupported sent.DM message status' using errcode = '22023';
  end if;

  select * into v_message from public.lead_messages
  where provider = 'SENT_DM' and provider_message_id = p_provider_message_id
  for update;
  if not found then return null; end if;

  v_current_rank := case v_message.delivery_status
    when 'PENDING' then 10 when 'QUEUED' then 20 when 'ROUTED' then 30
    when 'SCHEDULED' then 35 when 'SENT' then 40 when 'DELIVERED' then 50
    when 'READ' then 60 when 'FAILED' then 70 when 'FILTERED' then 70
    when 'BLOCKED' then 70 else 0 end;
  v_next_rank := case v_status
    when 'PENDING' then 10 when 'QUEUED' then 20 when 'ROUTED' then 30
    when 'SCHEDULED' then 35 when 'SENT' then 40 when 'DELIVERED' then 50
    when 'READ' then 60 else 70 end;

  if v_next_rank >= v_current_rank then
    update public.lead_messages set
      delivery_status = v_status,
      provider_status = v_status,
      send_error = case when v_status in ('FAILED','FILTERED','BLOCKED')
        then nullif(trim(p_error_message), '') else null end,
      sent_at = case when v_status in ('SENT','DELIVERED','READ')
        then coalesce(sent_at, now()) else sent_at end,
      delivered_at = case when v_status in ('DELIVERED','READ')
        then coalesce(delivered_at, now()) else delivered_at end,
      failed_at = case when v_status in ('FAILED','FILTERED','BLOCKED')
        then coalesce(failed_at, now()) else failed_at end,
      updated_at = now()
    where id = v_message.id
    returning * into v_message;
  end if;

  return jsonb_build_object(
    'message_id', v_message.id,
    'lead_id', v_message.lead_id,
    'customer_id', v_message.customer_id,
    'delivery_status', v_message.delivery_status
  );
end;
$$;

revoke all on function public.apply_sms_delivery_status(text,text,text) from public, anon, authenticated;
grant execute on function public.apply_sms_delivery_status(text,text,text) to service_role;

commit;
