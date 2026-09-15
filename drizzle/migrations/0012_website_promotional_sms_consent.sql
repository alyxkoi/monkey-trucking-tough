-- Record the expanded, single-checkbox website disclosure without treating
-- older customer-care consent as promotional email or SMS permission.
alter table public.contact_submissions
  add column if not exists sms_marketing_consent boolean not null default false,
  add column if not exists sms_marketing_consent_at timestamptz,
  add column if not exists email_marketing_consent boolean not null default false,
  add column if not exists email_marketing_consent_at timestamptz,
  add column if not exists marketing_consent_disclosure_version text,
  add column if not exists marketing_consent_disclosure_text text;

alter table public.contact_submissions
  drop constraint if exists contact_submissions_sms_marketing_consent_at_check;
alter table public.contact_submissions
  add constraint contact_submissions_sms_marketing_consent_at_check
  check (
    (sms_marketing_consent
      and sms_marketing_consent_at is not null
      and nullif(marketing_consent_disclosure_version, '') is not null
      and nullif(marketing_consent_disclosure_text, '') is not null)
    or (not sms_marketing_consent and sms_marketing_consent_at is null)
  );

alter table public.contact_submissions
  drop constraint if exists contact_submissions_email_marketing_consent_at_check;
alter table public.contact_submissions
  add constraint contact_submissions_email_marketing_consent_at_check
  check (
    (email_marketing_consent and email_marketing_consent_at is not null)
    or (not email_marketing_consent and email_marketing_consent_at is null)
  );

create index if not exists contact_submissions_sms_marketing_consent_idx
  on public.contact_submissions (sms_marketing_consent_at desc)
  where sms_marketing_consent;

create index if not exists contact_submissions_email_marketing_consent_idx
  on public.contact_submissions (email_marketing_consent_at desc)
  where email_marketing_consent;

comment on column public.contact_submissions.sms_marketing_consent_at is
  'Explicit website consent time for Monkey Trucking promotional SMS. Existing customer-care submissions are intentionally not backfilled.';

comment on column public.contact_submissions.email_marketing_consent_at is
  'Explicit website consent time for Monkey Trucking promotional email. Existing customer-care submissions are intentionally not backfilled.';

alter table public.customers
  add column if not exists email_marketing_consent_at timestamptz;

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
    sms_marketing_consent,
    sms_marketing_consent_at,
    email_marketing_consent,
    email_marketing_consent_at,
    marketing_consent_disclosure_version,
    marketing_consent_disclosure_text,
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
    coalesce((p_submission->>'sms_marketing_consent')::boolean, false),
    nullif(p_submission->>'sms_marketing_consent_at', '')::timestamptz,
    coalesce((p_submission->>'email_marketing_consent')::boolean, false),
    nullif(p_submission->>'email_marketing_consent_at', '')::timestamptz,
    nullif(p_submission->>'marketing_consent_disclosure_version', ''),
    nullif(p_submission->>'marketing_consent_disclosure_text', ''),
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

create or replace function public.sync_contact_submission_sms_consent()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.sms_consent and new.customer_id is not null then
    update public.customers
    set sms_consent_at = coalesce(sms_consent_at, new.sms_consent_at, new.submitted_at),
        sms_consent_source = coalesce(sms_consent_source, new.consent_source),
        sms_marketing_consent_at = case
          when new.sms_marketing_consent then coalesce(sms_marketing_consent_at, new.sms_marketing_consent_at, new.submitted_at)
          else sms_marketing_consent_at
        end,
        email_marketing_consent_at = case
          when new.email_marketing_consent then coalesce(email_marketing_consent_at, new.email_marketing_consent_at, new.submitted_at)
          else email_marketing_consent_at
        end,
        updated_at = now()
    where id = new.customer_id and sms_opted_out_at is null;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_contact_submission_sms_consent() from public, anon, authenticated;