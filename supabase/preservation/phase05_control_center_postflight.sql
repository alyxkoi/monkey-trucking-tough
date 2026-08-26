begin transaction read only;

select
  to_regclass('public.customers') as customers,
  to_regclass('public.leads') as leads,
  to_regclass('public.quotes') as quotes,
  to_regclass('public.quote_items') as quote_items,
  to_regclass('public.jobs') as jobs,
  to_regclass('public.invoices') as invoices,
  to_regclass('public.invoice_tickets') as invoice_tickets,
  to_regclass('public.payments') as payments,
  to_regclass('public.workers') as workers,
  to_regclass('public.worker_payments') as worker_payments,
  to_regclass('public.activity_history') as activity_history,
  to_regclass('public.financial_history') as financial_history,
  to_regprocedure('public.create_ticket_compat_atomic(jsonb,jsonb,text,boolean)') as ticket_compat_rpc,
  to_regprocedure('public.create_control_center_ticket_atomic(jsonb,jsonb,text,uuid,uuid,boolean)') as control_ticket_rpc,
  to_regprocedure('public.create_invoice_from_job(uuid)') as job_invoice_rpc,
  to_regprocedure('public.create_invoice_from_standalone_ticket(uuid)') as ticket_invoice_rpc,
  to_regprocedure('public.record_invoice_payment_full(uuid,text,timestamp with time zone,text)') as payment_rpc,
  to_regprocedure('public.create_worker_payment_pending(uuid,date,date,numeric,numeric,numeric,text,text)') as worker_pay_rpc,
  to_regprocedure('public.void_financial_record(text,uuid,text)') as financial_void_rpc;

select ticket_prefix, next_ticket_number
from public.app_settings;

select
  count(*) as legacy_ticket_count,
  count(*) filter (where customer_id is null) as legacy_or_unlinked_customer,
  count(*) filter (where job_id is null) as standalone_or_legacy_ticket
from public.tickets;

select count(*) as legacy_item_loads_still_unknown
from public.ticket_items
where loads is null;

select tablename, policyname, cmd
from pg_policies
where schemaname='public'
  and tablename in ('customers','leads','quotes','quote_items','jobs','invoices','invoice_tickets','payments','workers','worker_payments','activity_history','financial_history','lead_messages','attention_snoozes','control_center_settings','automation_rules','tracking_links')
order by tablename, policyname;

select id, status from public.automation_rules order by id;
select * from public.control_center_settings where id=1;

rollback;
