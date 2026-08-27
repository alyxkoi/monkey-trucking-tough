-- Public website contact submissions and auditable SMS consent.
-- The website never writes this table directly. The send-contact-email Edge
-- Function records the server-controlled disclosure metadata with service_role.

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  email_message_id uuid not null unique,
  name text not null,
  email text not null,
  phone text not null,
  project_type text,
  message text,
  sms_consent boolean not null default false,
  sms_consent_at timestamptz,
  consent_source text not null,
  consent_disclosure_version text not null,
  consent_disclosure_text text not null,
  submitted_at timestamptz not null default now(),
  constraint contact_submissions_sms_consent_at_check
    check (
      (sms_consent and sms_consent_at is not null)
      or (not sms_consent and sms_consent_at is null)
    )
);

comment on table public.contact_submissions is
  'Public contact form submissions with the exact SMS consent state and disclosure version shown at submission time.';

create index if not exists contact_submissions_submitted_at_idx
  on public.contact_submissions (submitted_at desc);

create index if not exists contact_submissions_sms_consent_idx
  on public.contact_submissions (sms_consent_at desc)
  where sms_consent;

alter table public.contact_submissions enable row level security;

revoke all on table public.contact_submissions from public, anon;
grant select on table public.contact_submissions to authenticated;
grant all on table public.contact_submissions to service_role;

drop policy if exists contact_submissions_admin_staff_read on public.contact_submissions;
create policy contact_submissions_admin_staff_read
  on public.contact_submissions
  for select
  to authenticated
  using (public.is_admin_or_staff());

-- No authenticated insert, update, or delete policy. Public submissions enter
-- through the validated Edge Function; consent history cannot be rewritten.
