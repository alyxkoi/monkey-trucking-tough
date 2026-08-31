-- Durable website-request identity and safe customer contact maintenance.
-- Forward only: no existing Customer, Lead, Contact, Ticket, Invoice, Payment,
-- pricing snapshot, or MT counter value is rewritten.

begin;

-- The managed queue worker already records this recoverable state. Keep the
-- log constraint aligned so a provider throttle cannot make logging fail.
alter table public.email_send_log drop constraint if exists email_send_log_status_check;
alter table public.email_send_log add constraint email_send_log_status_check
  check (status in ('pending','sent','accepted_by_provider','suppressed','failed','bounced','complained','dlq','rate_limited'));

create or replace function public.create_website_contact_submission(p_submission jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id uuid;
  v_row public.contact_submissions%rowtype;
begin
  v_request_id := nullif(p_submission->>'email_message_id', '')::uuid;
  if v_request_id is null then
    raise exception 'A contact request id is required' using errcode = '22023';
  end if;

  -- The lock happens before the website-lead trigger. A browser retry therefore
  -- cannot create a second Lead and then lose to the table's unique constraint.
  perform pg_advisory_xact_lock(hashtextextended('website-contact:' || v_request_id::text, 0));

  select * into v_row
  from public.contact_submissions
  where email_message_id = v_request_id;

  if found then
    return jsonb_build_object(
      'id', v_row.id,
      'customer_id', v_row.customer_id,
      'lead_id', v_row.lead_id,
      'created', false
    );
  end if;

  insert into public.contact_submissions (
    email_message_id,
    name,
    email,
    phone,
    project_type,
    message,
    sms_consent,
    sms_consent_at,
    consent_source,
    consent_disclosure_version,
    consent_disclosure_text,
    source,
    campaign,
    tracking_link_id
  ) values (
    v_request_id,
    trim(p_submission->>'name'),
    trim(p_submission->>'email'),
    trim(p_submission->>'phone'),
    nullif(trim(p_submission->>'project_type'), ''),
    nullif(p_submission->>'message', ''),
    coalesce((p_submission->>'sms_consent')::boolean, false),
    nullif(p_submission->>'sms_consent_at', '')::timestamptz,
    p_submission->>'consent_source',
    p_submission->>'consent_disclosure_version',
    p_submission->>'consent_disclosure_text',
    nullif(p_submission->>'source', ''),
    nullif(p_submission->>'campaign', ''),
    nullif(p_submission->>'tracking_link_id', '')::uuid
  ) returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'customer_id', v_row.customer_id,
    'lead_id', v_row.lead_id,
    'created', true
  );
end;
$$;

revoke all on function public.create_website_contact_submission(jsonb) from public, anon, authenticated;
grant execute on function public.create_website_contact_submission(jsonb) to service_role;

create or replace function public.update_customer_contact(
  p_customer_id uuid,
  p_phone text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.customers%rowtype;
  v_duplicate public.customers%rowtype;
  v_phone_digits text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_phone text;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_phone_display text := nullif(trim(coalesce(p_phone, '')), '');
  v_email_display text := nullif(trim(coalesce(p_email, '')), '');
  v_changed_fields text[] := array[]::text[];
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;

  if v_phone_digits is not null then
    if length(v_phone_digits) = 11 and left(v_phone_digits, 1) = '1' then
      v_phone := right(v_phone_digits, 10);
    elsif length(v_phone_digits) = 10 then
      v_phone := v_phone_digits;
    else
      raise exception 'Enter a valid 10 digit phone number' using errcode = '22023';
    end if;
  end if;

  if v_email is not null and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;
  if v_phone is null and v_email is null then
    raise exception 'Keep at least a phone number or an email on the customer' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('customer-contact:' || coalesce(v_phone, '') || '|' || coalesce(v_email, ''), 0));
  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found then raise exception 'Customer not found' using errcode = 'P0002'; end if;

  if v_phone is not null then
    select * into v_duplicate from public.customers
    where id <> p_customer_id
      and normalized_phone in (v_phone, '1' || v_phone)
    order by last_activity_at desc limit 1;
    if found then
      return jsonb_build_object('status', 'DUPLICATE', 'field', 'PHONE', 'customer_id', v_duplicate.id, 'customer_name', v_duplicate.name);
    end if;
  end if;

  if v_email is not null then
    select * into v_duplicate from public.customers
    where id <> p_customer_id and normalized_email = v_email
    order by last_activity_at desc limit 1;
    if found then
      return jsonb_build_object('status', 'DUPLICATE', 'field', 'EMAIL', 'customer_id', v_duplicate.id, 'customer_name', v_duplicate.name);
    end if;
  end if;

  if v_customer.normalized_phone is distinct from v_phone then
    v_changed_fields := array_append(v_changed_fields, 'phone');
  end if;
  if v_customer.normalized_email is distinct from v_email then
    v_changed_fields := array_append(v_changed_fields, 'email');
  end if;

  if cardinality(v_changed_fields) > 0 then
    update public.customers set
      phone = v_phone_display,
      normalized_phone = v_phone,
      email = v_email_display,
      normalized_email = v_email,
      last_activity_at = now(),
      updated_at = now()
    where id = p_customer_id
    returning * into v_customer;

    insert into public.activity_history (
      customer_id, entity_type, entity_id, event_type, summary, metadata, actor_id, actor_label
    ) values (
      v_customer.id,
      'CUSTOMER',
      v_customer.id,
      'CONTACT_UPDATED',
      'Customer contact details updated',
      jsonb_build_object('changed_fields', to_jsonb(v_changed_fields)),
      auth.uid(),
      coalesce(auth.jwt()->>'email', auth.uid()::text)
    );
  end if;

  return jsonb_build_object('status', 'UPDATED', 'customer', to_jsonb(v_customer));
end;
$$;

revoke all on function public.update_customer_contact(uuid,text,text) from public, anon;
grant execute on function public.update_customer_contact(uuid,text,text) to authenticated;

commit;
