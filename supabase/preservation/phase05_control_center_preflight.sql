begin transaction read only;

-- Run in Lovable's managed SQL workflow only after confirming a recoverable
-- managed backup. This script changes nothing.

select
  current_database() as database_name,
  now() as inspected_at,
  to_regclass('public.user_roles') as user_roles,
  to_regclass('public.app_settings') as app_settings,
  to_regclass('public.materials') as materials,
  to_regclass('public.drivers') as drivers,
  to_regclass('public.tickets') as tickets,
  to_regclass('public.ticket_items') as ticket_items,
  to_regclass('public.ticket_history') as ticket_history,
  to_regprocedure('public.next_ticket_number()') as next_ticket_number,
  to_regprocedure('public.create_ticket_atomic(jsonb,jsonb,uuid,boolean)') as create_ticket_atomic_uuid,
  to_regprocedure('public.create_ticket_atomic(jsonb,jsonb,text,boolean)') as create_ticket_atomic_text,
  to_regprocedure('public.is_admin_or_staff()') as role_gate_no_arg,
  to_regprocedure('public.is_admin_or_staff(uuid)') as role_gate_user_arg;

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
  and (table_name,column_name) in (
    ('tickets','client_request_id'),('tickets','status'),
    ('ticket_items','loads'),('ticket_items','superseded_at')
  )
order by table_name,column_name;

select ticket_prefix, next_ticket_number, tax_rate, tax_applies_to_delivery,
  print_method, print_copies
from public.app_settings;

select pg_get_functiondef('public.next_ticket_number()'::regprocedure) as next_ticket_number_definition;

select role::text, count(*) as accounts
from public.user_roles
group by role
order by role;

select
  count(*) as ticket_count,
  count(*) filter (where status = 'void') as void_count,
  count(*) filter (where client_request_id is null) as legacy_without_request_id,
  count(*) filter (where tax_applies_to_delivery is null) as legacy_without_tax_delivery_snapshot,
  min(created_at) as oldest_ticket,
  max(created_at) as newest_ticket
from public.tickets;

select
  count(*) as item_count,
  count(*) filter (where loads is null) as item_loads_unknown,
  count(*) filter (where superseded_at is not null) as superseded_items
from public.ticket_items;

select ticket_number, count(*)
from public.tickets
group by ticket_number
having count(*) > 1;

select client_request_id, count(*)
from public.tickets
where client_request_id is not null
group by client_request_id
having count(*) > 1;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('app_settings','drivers','materials','ticket_items','tickets','ticket_history','user_roles')
order by tablename, policyname;

select
  to_regclass('public.customers') as existing_customers,
  to_regclass('public.leads') as existing_leads,
  to_regclass('public.quotes') as existing_quotes,
  to_regclass('public.jobs') as existing_jobs,
  to_regclass('public.invoices') as existing_invoices,
  to_regclass('public.payments') as existing_payments,
  to_regclass('public.workers') as existing_workers;

rollback;
