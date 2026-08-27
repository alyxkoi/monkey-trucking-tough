-- Read-only preflight for 20260827180000_phase06_transactional_customer_email.sql.
-- Run in Lovable/Supabase before applying the migration. This file performs no writes.

select
  to_regclass('public.customers') as customers,
  to_regclass('public.quotes') as quotes,
  to_regclass('public.quote_items') as quote_items,
  to_regclass('public.invoices') as invoices,
  to_regclass('public.payments') as payments,
  to_regclass('public.email_send_log') as existing_email_send_log,
  to_regclass('public.activity_history') as activity_history;

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('customers','quotes','quote_items','invoices','invoice_tickets','payments','email_send_log')
order by table_name, ordinal_position;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('customers','quotes','quote_items','invoices','invoice_tickets','payments','email_send_log')
order by tablename, policyname;

select role::text, count(*) as users
from public.user_roles
group by role::text
order by role::text;

select status, count(*) as quote_count
from public.quotes
group by status
order by status;

select status, count(*) as invoice_count
from public.invoices
group by status
order by status;

select confirmed_by, count(*) as active_payment_count
from public.payments
where voided_at is null
group by confirmed_by
order by confirmed_by;

select template_name, status, count(*) as send_count
from public.email_send_log
group by template_name, status
order by template_name, status;

