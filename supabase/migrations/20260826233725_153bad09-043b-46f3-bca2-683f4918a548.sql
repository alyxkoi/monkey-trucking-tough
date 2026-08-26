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

revoke all on function public.create_invoice_from_job(uuid) from public, anon;
revoke all on function public.create_invoice_from_standalone_ticket(uuid) from public, anon;
revoke all on function public.record_invoice_payment_full(uuid,text,timestamptz,text) from public, anon;
revoke all on function public.create_worker_payment_pending(uuid,date,date,numeric,numeric,numeric,text,text) from public, anon;
revoke all on function public.void_financial_record(text,uuid,text) from public, anon;
revoke all on function public.confirm_worker_payment_details(uuid) from public, anon;
revoke all on function public.mark_worker_payment_paid(uuid) from public, anon;

grant execute on function public.create_invoice_from_job(uuid) to authenticated;
grant execute on function public.create_invoice_from_standalone_ticket(uuid) to authenticated;
grant execute on function public.record_invoice_payment_full(uuid,text,timestamptz,text) to authenticated;
grant execute on function public.create_worker_payment_pending(uuid,date,date,numeric,numeric,numeric,text,text) to authenticated;
grant execute on function public.void_financial_record(text,uuid,text) to authenticated;
grant execute on function public.confirm_worker_payment_details(uuid) to authenticated;
grant execute on function public.mark_worker_payment_paid(uuid) to authenticated;