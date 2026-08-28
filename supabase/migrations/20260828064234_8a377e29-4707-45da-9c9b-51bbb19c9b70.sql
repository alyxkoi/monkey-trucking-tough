-- Configurable current tax plus historically safe Invoice processing-fee snapshots.
-- Existing Tickets, Quotes, Invoices, Payments, pricing snapshots, and counters are
-- deliberately not rewritten.

begin;

do $$
begin
  if to_regclass('public.app_settings') is null
    or to_regclass('public.control_center_settings') is null
    or to_regclass('public.invoices') is null then
    raise exception 'Business billing rules require app_settings, control_center_settings, and invoices';
  end if;
end
$$;

alter table public.app_settings
  add column if not exists tax_enabled boolean;

-- Preserve the meaning of any already-configured nonzero rate. The current 0%
-- production setting becomes explicitly off.
update public.app_settings
set tax_enabled = coalesce(tax_enabled, tax_rate > 0)
where tax_enabled is null;

alter table public.app_settings
  alter column tax_enabled set default false,
  alter column tax_enabled set not null;

alter table public.control_center_settings
  add column if not exists processing_fee_enabled boolean not null default false,
  add column if not exists processing_fee_rate numeric(7,4) not null default 0;

alter table public.control_center_settings
  drop constraint if exists control_center_processing_fee_rate_check;
alter table public.control_center_settings
  add constraint control_center_processing_fee_rate_check
  check (processing_fee_rate >= 0 and processing_fee_rate <= 100);

-- Nullable with no default is intentional: legacy Invoice totals remain exactly
-- what they were and are never reinterpreted as containing a fee.
alter table public.invoices
  add column if not exists subtotal_amount numeric,
  add column if not exists processing_fee_rate numeric(7,4),
  add column if not exists processing_fee_amount numeric;

alter table public.invoices
  drop constraint if exists invoices_subtotal_amount_check,
  drop constraint if exists invoices_processing_fee_rate_check,
  drop constraint if exists invoices_processing_fee_amount_check;
alter table public.invoices
  add constraint invoices_subtotal_amount_check check (subtotal_amount is null or subtotal_amount >= 0),
  add constraint invoices_processing_fee_rate_check check (processing_fee_rate is null or (processing_fee_rate >= 0 and processing_fee_rate <= 100)),
  add constraint invoices_processing_fee_amount_check check (processing_fee_amount is null or processing_fee_amount >= 0);

create or replace function public.create_quote_draft_from_lead(p_lead_id uuid)
returns table (id uuid, quote_number text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_lead public.leads%rowtype;
  v_id uuid;
  v_number text;
  v_tax_enabled boolean;
  v_tax_rate numeric;
  v_tax_delivery boolean;
  v_custom_rule text;
begin
  if not public.is_admin_or_staff() then
    raise exception 'Admin or staff role required' using errcode = '42501';
  end if;
  select * into v_lead from public.leads where public.leads.id = p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;

  select q.id, q.quote_number into v_id, v_number
  from public.quotes q where q.lead_id = p_lead_id and q.status <> 'VOID'
  order by q.created_at desc limit 1;
  if found then return query select v_id, v_number; return; end if;

  select tax_enabled, tax_rate, tax_applies_to_delivery
    into v_tax_enabled, v_tax_rate, v_tax_delivery
  from public.app_settings order by id limit 1;
  select custom_work_tax_rule into v_custom_rule
  from public.control_center_settings where public.control_center_settings.id = 1;

  v_number := public.next_quote_number();
  insert into public.quotes (
    quote_number, customer_id, lead_id, status, description, address,
    delivery_load_count, tax_rate, tax_applies_to_delivery, custom_work_tax_rule
  ) values (
    v_number, v_lead.customer_id, v_lead.id, 'DRAFT', v_lead.need, '',
    1, case when coalesce(v_tax_enabled, false) then coalesce(v_tax_rate, 0) else 0 end,
    coalesce(v_tax_delivery, true), coalesce(v_custom_rule, 'PENDING')
  ) returning public.quotes.id into v_id;

  update public.leads set status = 'QUOTED' where public.leads.id = p_lead_id;
  update public.customers set last_activity_at = now() where public.customers.id = v_lead.customer_id;
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, actor_label)
    values (v_lead.customer_id, 'QUOTE', v_id, 'CREATED', 'Quote ' || v_number || ' draft created', coalesce(auth.jwt()->>'email', auth.uid()::text));
  return query select v_id, v_number;
end;
$$;

create or replace function public.create_invoice_from_job(p_job_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_job public.jobs%rowtype;
  v_quote public.quotes%rowtype;
  v_id uuid;
  v_number text;
  v_source text;
  v_subtotal numeric;
  v_fee_enabled boolean;
  v_fee_rate numeric;
  v_fee numeric;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode='42501'; end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found or v_job.status <> 'COMPLETED' then raise exception 'Only a completed job can be invoiced'; end if;
  select id into v_id from public.invoices where job_id=p_job_id and status<>'VOID';
  if found then return v_id; end if;

  if v_job.quote_id is not null then
    select * into v_quote from public.quotes where id=v_job.quote_id;
    if not found or v_quote.status <> 'ACCEPTED' then raise exception 'The linked Quote is not accepted'; end if;
    v_source := 'QUOTE';
    v_subtotal := v_quote.grand_total;
  else
    v_source := 'JOB';
    v_subtotal := v_job.agreed_amount;
  end if;

  select processing_fee_enabled, processing_fee_rate into v_fee_enabled, v_fee_rate
  from public.control_center_settings where id = 1;
  v_subtotal := round(coalesce(v_subtotal, 0), 2);
  v_fee_rate := case when coalesce(v_fee_enabled, false) then coalesce(v_fee_rate, 0) else 0 end;
  v_fee := round(v_subtotal * v_fee_rate / 100, 2);
  v_number := public.next_invoice_number();

  insert into public.invoices (
    invoice_number, customer_id, job_id, quote_id, amount_source, description,
    subtotal_amount, processing_fee_rate, processing_fee_amount, amount
  ) values (
    v_number, v_job.customer_id, v_job.id, v_job.quote_id, v_source, v_job.description,
    v_subtotal, v_fee_rate, v_fee, v_subtotal + v_fee
  ) returning id into v_id;

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

create or replace function public.create_invoice_from_standalone_ticket(p_ticket_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ticket public.tickets%rowtype;
  v_id uuid;
  v_number text;
  v_subtotal numeric;
  v_fee_enabled boolean;
  v_fee_rate numeric;
  v_fee numeric;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode = '42501'; end if;
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found or coalesce(v_ticket.status,'') not in ('saved','active') or v_ticket.job_id is not null or v_ticket.customer_id is null then
    raise exception 'Ticket is not an eligible finalized standalone ticket';
  end if;
  select i.id into v_id from public.invoices i
  where i.standalone_ticket_id = p_ticket_id and i.status <> 'VOID';
  if found then return v_id; end if;

  select processing_fee_enabled, processing_fee_rate into v_fee_enabled, v_fee_rate
  from public.control_center_settings where id = 1;
  v_subtotal := round(v_ticket.grand_total, 2);
  v_fee_rate := case when coalesce(v_fee_enabled, false) then coalesce(v_fee_rate, 0) else 0 end;
  v_fee := round(v_subtotal * v_fee_rate / 100, 2);
  v_number := public.next_invoice_number();

  insert into public.invoices (
    invoice_number, customer_id, standalone_ticket_id, amount_source, description,
    subtotal_amount, processing_fee_rate, processing_fee_amount, amount
  ) values (
    v_number, v_ticket.customer_id, p_ticket_id, 'TICKET', 'Direct material order ' || v_ticket.ticket_number,
    v_subtotal, v_fee_rate, v_fee, v_subtotal + v_fee
  ) returning id into v_id;

  insert into public.invoice_tickets (invoice_id, ticket_id) values (v_id, p_ticket_id);
  insert into public.financial_history (record_type, record_id, event_type, reason, after_snapshot, actor_label)
    values ('INVOICE', v_id, 'CREATED', 'Invoice created from finalized standalone Ticket',
      (select to_jsonb(i) from public.invoices i where id=v_id), coalesce(auth.jwt()->>'email',auth.uid()::text));
  insert into public.activity_history (customer_id, entity_type, entity_id, event_type, summary, actor_label)
    values (v_ticket.customer_id, 'INVOICE', v_id, 'CREATED', 'Invoice ' || v_number || ' created from ' || v_ticket.ticket_number, coalesce(auth.jwt()->>'email',auth.uid()::text));
  return v_id;
end;
$$;

create or replace function public.revise_draft_invoice(
  p_invoice_id uuid, p_amount numeric, p_description text, p_reason text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_before public.invoices%rowtype;
  v_subtotal numeric;
  v_fee_rate numeric;
  v_fee numeric;
begin
  if not public.is_admin_or_staff() then raise exception 'Admin or staff role required' using errcode='42501'; end if;
  if p_amount <= 0 or nullif(trim(p_description),'') is null or nullif(trim(p_reason),'') is null then
    raise exception 'A positive amount, description, and reason are required';
  end if;
  select * into v_before from public.invoices where id=p_invoice_id for update;
  if not found or v_before.status <> 'DRAFT' then raise exception 'Only a draft Invoice can be revised'; end if;

  -- Revisions retain the Invoice's own snapshotted fee rate. Legacy drafts have
  -- null snapshots and therefore remain fee-free.
  v_subtotal := round(p_amount, 2);
  v_fee_rate := coalesce(v_before.processing_fee_rate, 0);
  v_fee := round(v_subtotal * v_fee_rate / 100, 2);
  perform set_config('app.financial_safe_write','true',true);
  update public.invoices
  set subtotal_amount=v_subtotal,
      processing_fee_amount=v_fee,
      amount=v_subtotal+v_fee,
      description=trim(p_description),
      updated_at=now()
  where id=p_invoice_id;
  insert into public.financial_history (record_type,record_id,event_type,reason,before_snapshot,after_snapshot,actor_label)
    values ('INVOICE',p_invoice_id,'DRAFT_REVISED',trim(p_reason),to_jsonb(v_before),
      (select to_jsonb(i) from public.invoices i where i.id=p_invoice_id),coalesce(auth.jwt()->>'email',auth.uid()::text));
end;
$$;

revoke all on function public.create_quote_draft_from_lead(uuid) from public, anon;
revoke all on function public.create_invoice_from_job(uuid) from public, anon;
revoke all on function public.create_invoice_from_standalone_ticket(uuid) from public, anon;
revoke all on function public.revise_draft_invoice(uuid,numeric,text,text) from public, anon;
grant execute on function public.create_quote_draft_from_lead(uuid) to authenticated;
grant execute on function public.create_invoice_from_job(uuid) to authenticated;
grant execute on function public.create_invoice_from_standalone_ticket(uuid) to authenticated;
grant execute on function public.revise_draft_invoice(uuid,numeric,text,text) to authenticated;

commit;