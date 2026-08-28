-- READ ONLY. Run after 20260828013000_phase06_ticket_delete_readiness.sql.
-- Compare next_ticket_number with the preflight output; it must be unchanged.

select
  to_regclass('public.ticket_deletion_audit') as ticket_deletion_audit,
  to_regprocedure('public.delete_ticket_permanently(uuid,text,text)') as delete_ticket_permanently;

select
  column_name,
  data_type,
  column_default,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'control_center_settings'
  and column_name = 'email_status';

select
  ticket_prefix,
  next_ticket_number,
  tax_rate
from public.app_settings;

select
  printable_logo_status,
  email_status,
  sms_status,
  calling_status,
  ai_status,
  payment_processor_status
from public.control_center_settings
where id = 1;

select
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'delete_ticket_permanently'
order by grantee, privilege_type;
