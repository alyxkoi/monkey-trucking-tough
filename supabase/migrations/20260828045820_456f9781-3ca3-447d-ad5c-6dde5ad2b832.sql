-- Phase 06: OpenAI intelligence layer, draft only.
-- Forward-safe: this migration does not update business records, financial truth,
-- ticket snapshots, ticket items, or the MT ticket counter.

alter table public.customers
  add column if not exists sms_consent_at timestamptz,
  add column if not exists sms_consent_source text,
  add column if not exists sms_opted_out_at timestamptz;

comment on column public.customers.sms_consent_at is 'Confirmed customer-level SMS consent. Legacy null remains unknown and is never inferred.';
comment on column public.customers.sms_opted_out_at is 'Durable automation stop state. Future transport webhooks may set this field.';

create table if not exists public.ai_conversation_state (
  lead_id uuid primary key references public.leads(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  known_facts jsonb not null default '[]'::jsonb,
  missing_facts jsonb not null default '[]'::jsonb,
  uncertain_facts jsonb not null default '[]'::jsonb,
  last_evaluated_message_id uuid references public.lead_messages(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_audit_logs (
  id uuid primary key default gen_random_uuid(),
  evaluation_type text not null check (evaluation_type in ('CONVERSATION','AUTOMATION_DRY_RUN')),
  customer_id uuid references public.customers(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete restrict,
  automation_rule_id text references public.automation_rules(id) on delete restrict,
  model_id text,
  prompt_version text not null,
  language text check (language is null or language in ('ENGLISH','SPANISH','SPANGLISH')),
  decision jsonb,
  concise_rationale text,
  status text not null check (status in ('SUCCESS','FAILED')),
  latency_ms integer,
  tool_results jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_drafts (
  id uuid primary key default gen_random_uuid(),
  audit_log_id uuid not null references public.ai_audit_logs(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  automation_rule_id text references public.automation_rules(id) on delete restrict,
  status text not null default 'DRAFT' check (status in ('DRAFT','DISCARDED')),
  body text not null,
  language text not null check (language in ('ENGLISH','SPANISH','SPANGLISH')),
  decision jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_audit_logs_lead_created_idx on public.ai_audit_logs (lead_id, created_at desc);
create index if not exists ai_audit_logs_rule_created_idx on public.ai_audit_logs (automation_rule_id, created_at desc);
create index if not exists ai_drafts_lead_created_idx on public.ai_drafts (lead_id, created_at desc);
create index if not exists ai_drafts_rule_created_idx on public.ai_drafts (automation_rule_id, created_at desc);

alter table public.ai_conversation_state enable row level security;
alter table public.ai_audit_logs enable row level security;
alter table public.ai_drafts enable row level security;

drop policy if exists ai_conversation_state_read on public.ai_conversation_state;
create policy ai_conversation_state_read on public.ai_conversation_state
  for select to authenticated using (public.is_admin_or_staff());

drop policy if exists ai_audit_logs_read on public.ai_audit_logs;
create policy ai_audit_logs_read on public.ai_audit_logs
  for select to authenticated using (public.is_admin_or_staff());

drop policy if exists ai_drafts_read on public.ai_drafts;
create policy ai_drafts_read on public.ai_drafts
  for select to authenticated using (public.is_admin_or_staff());

-- Writes are intentionally server-side only. No INSERT, UPDATE or DELETE policy
-- is granted to browser clients. The Edge Function verifies admin/staff first.
grant select on public.ai_conversation_state, public.ai_audit_logs, public.ai_drafts to authenticated;
revoke insert, update, delete on public.ai_conversation_state, public.ai_audit_logs, public.ai_drafts from authenticated, anon;
grant all on public.ai_conversation_state, public.ai_audit_logs, public.ai_drafts to service_role;

comment on table public.ai_drafts is 'Internal AI drafts only. No row represents a sent or delivered customer message.';
comment on table public.ai_audit_logs is 'Useful structured AI outcomes only. Never store secrets or hidden chain of thought.';