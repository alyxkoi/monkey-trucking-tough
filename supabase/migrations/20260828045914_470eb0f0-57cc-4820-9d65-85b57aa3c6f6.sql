-- Phase 06 transactional customer email and secure document access.
-- Forward-only: no historical quote, invoice, payment, Ticket, or MT counter
-- values are rewritten or recalculated.

do $$
begin
  if to_regclass('public.quotes') is null
    or to_regclass('public.quote_items') is null
    or to_regclass('public.invoices') is null
    or to_regclass('public.payments') is null
    or to_regclass('public.email_send_log') is null then
    raise exception 'Apply and verify the existing Control Center and email infrastructure before this migration';
  end if;
end;
$$;

create table if not exists public.customer_document_tokens (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('QUOTE','INVOICE')),
  quote_id uuid references public.quotes(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete restrict,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  first_viewed_at timestamptz,
  latest_viewed_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  check (
    (document_type = 'QUOTE' and quote_id is not null and invoice_id is null)
    or (document_type = 'INVOICE' and invoice_id is not null and quote_id is null)
  )
);

create index if not exists customer_document_tokens_quote_idx
  on public.customer_document_tokens (quote_id, created_at desc)
  where quote_id is not null;
create index if not exists customer_document_tokens_invoice_idx
  on public.customer_document_tokens (invoice_id, created_at desc)
  where invoice_id is not null;

alter table public.customer_document_tokens enable row level security;
revoke all on public.customer_document_tokens from public, anon, authenticated;
grant all on public.customer_document_tokens to service_role;

-- Reuse the managed email log already used by auth and contact email. Existing
-- rows remain valid and null in these new customer-document columns.
alter table public.email_send_log
  add column if not exists template_type text,
  add column if not exists customer_id uuid references public.customers(id) on delete restrict,
  add column if not exists quote_id uuid references public.quotes(id) on delete restrict,
  add column if not exists invoice_id uuid references public.invoices(id) on delete restrict,
  add column if not exists payment_id uuid references public.payments(id) on delete restrict,
  add column if not exists document_token_id uuid references public.customer_document_tokens(id) on delete restrict,
  add column if not exists provider_message_id text,
  add column if not exists idempotency_key text,
  add column if not exists sender_email text,
  add column if not exists reply_to text,
  add column if not exists attempted_at timestamptz,
  add column if not exists accepted_at timestamptz;

create unique index if not exists email_send_log_customer_idempotency_unique
  on public.email_send_log (idempotency_key)
  where idempotency_key is not null;
create index if not exists email_send_log_quote_idx
  on public.email_send_log (quote_id, created_at desc)
  where quote_id is not null;
create index if not exists email_send_log_invoice_idx
  on public.email_send_log (invoice_id, created_at desc)
  where invoice_id is not null;
create index if not exists email_send_log_payment_idx
  on public.email_send_log (payment_id, created_at desc)
  where payment_id is not null;

create or replace function public.finalize_customer_email_send(
  p_log_id uuid,
  p_provider_message_id text,
  p_due_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_log public.email_send_log%rowtype;
  v_customer_id uuid;
  v_summary text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  select * into v_log from public.email_send_log where id = p_log_id for update;
  if not found then raise exception 'Email send log not found'; end if;

  if v_log.status = 'accepted_by_provider' then return; end if;

  if v_log.template_type = 'QUOTE_READY' then
    update public.quotes
      set status = case when status = 'DRAFT' then 'SENT' else status end,
          sent_at = coalesce(sent_at, now())
      where id = v_log.quote_id and status in ('DRAFT','SENT','ACCEPTED');
    if not found then raise exception 'Quote is no longer eligible to send'; end if;
    v_customer_id := v_log.customer_id;
    v_summary := 'Quote email accepted by provider';
  elsif v_log.template_type = 'INVOICE_READY' then
    perform set_config('app.financial_safe_write', 'true', true);
    update public.invoices
      set status = case when status = 'DRAFT' then 'SENT' else status end,
          issued_at = coalesce(issued_at, now()),
          due_at = coalesce(due_at, p_due_at)
      where id = v_log.invoice_id and status in ('DRAFT','SENT');
    if not found then raise exception 'Invoice is no longer eligible to send'; end if;
    v_customer_id := v_log.customer_id;
    v_summary := 'Invoice email accepted by provider';
  elsif v_log.template_type = 'PAYMENT_RECEIVED' then
    if not exists (
      select 1 from public.payments
      where id = v_log.payment_id and voided_at is null
    ) then raise exception 'Payment is no longer eligible for a receipt'; end if;
    v_customer_id := v_log.customer_id;
    v_summary := 'Payment receipt email accepted by provider';
  else
    raise exception 'Unsupported customer email template';
  end if;

  update public.email_send_log
    set status = 'accepted_by_provider',
        provider_message_id = nullif(trim(p_provider_message_id), ''),
        accepted_at = now(),
        error_message = null
    where id = p_log_id;

  insert into public.activity_history (
    customer_id, entity_type, entity_id, event_type, summary, metadata, actor_label
  ) values (
    v_customer_id,
    case v_log.template_type when 'QUOTE_READY' then 'QUOTE' when 'INVOICE_READY' then 'INVOICE' else 'PAYMENT' end,
    coalesce(v_log.quote_id, v_log.invoice_id, v_log.payment_id),
    'EMAIL_ACCEPTED_BY_PROVIDER',
    v_summary,
    jsonb_build_object('template_type', v_log.template_type, 'provider_message_id', p_provider_message_id),
    'Monkey Trucking email service'
  );
end;
$$;

create or replace function public.accept_public_quote(p_token_hash text)
returns table (quote_id uuid, status text, accepted_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token public.customer_document_tokens%rowtype;
  v_quote public.quotes%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  select * into v_token
  from public.customer_document_tokens
  where token_hash = p_token_hash and document_type = 'QUOTE'
  for update;
  if not found or v_token.revoked_at is not null then
    raise exception 'This link is no longer available';
  end if;

  select * into v_quote from public.quotes where id = v_token.quote_id for update;
  if not found or v_quote.status in ('VOID','DECLINED') then
    raise exception 'This quote is no longer available';
  end if;
  if v_quote.status not in ('SENT','ACCEPTED') then
    raise exception 'This quote is not available for acceptance';
  end if;

  if v_quote.status = 'SENT' then
    update public.quotes
      set status = 'ACCEPTED', accepted_at = coalesce(accepted_at, now())
      where id = v_quote.id
      returning * into v_quote;
    insert into public.activity_history (
      customer_id, entity_type, entity_id, event_type, summary, actor_label
    ) values (
      v_quote.customer_id, 'QUOTE', v_quote.id, 'ACCEPTED',
      'Quote ' || v_quote.quote_number || ' accepted through secure customer page',
      'Customer'
    );
  end if;

  update public.customer_document_tokens
    set accepted_at = coalesce(customer_document_tokens.accepted_at, v_quote.accepted_at)
    where id = v_token.id;

  return query select v_quote.id, v_quote.status, v_quote.accepted_at;
end;
$$;

revoke all on function public.finalize_customer_email_send(uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.accept_public_quote(text) from public, anon, authenticated;
grant execute on function public.finalize_customer_email_send(uuid,text,timestamptz) to service_role;
grant execute on function public.accept_public_quote(text) to service_role;