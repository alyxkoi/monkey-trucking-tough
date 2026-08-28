-- READ ONLY. Run in Lovable before 20260828013000_phase06_ticket_delete_readiness.sql.

select
  to_regclass('public.tickets') as tickets,
  to_regclass('public.ticket_items') as ticket_items,
  to_regclass('public.ticket_history') as ticket_history,
  to_regclass('public.invoices') as invoices,
  to_regclass('public.invoice_tickets') as invoice_tickets,
  to_regclass('public.payments') as payments,
  to_regclass('public.activity_history') as activity_history,
  to_regclass('public.control_center_settings') as control_center_settings;

select
  ticket_prefix,
  next_ticket_number,
  tax_rate,
  tax_applies_to_delivery
from public.app_settings;

select
  count(*) filter (where status = 'PAID') as paid_invoices,
  count(*) filter (where standalone_ticket_id is not null) as standalone_ticket_invoices
from public.invoices;

select count(*) as invoice_ticket_links from public.invoice_tickets;

select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column,
  rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.constraint_schema = kcu.constraint_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.constraint_schema = tc.constraint_schema
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.constraint_schema
where tc.constraint_type = 'FOREIGN KEY'
  and ccu.table_schema = 'public'
  and ccu.table_name = 'tickets'
order by tc.table_name, kcu.column_name;

select
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('is_admin_or_staff', 'next_ticket_number', 'delete_material_if_unused')
order by routine_name;
