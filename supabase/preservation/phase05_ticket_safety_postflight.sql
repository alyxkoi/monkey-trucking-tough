-- Phase 05 Ticket safety verification.
-- READ ONLY. Run through Lovable after the migration is applied.

select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'ticket_items' and column_name in ('loads', 'superseded_at'))
    or (table_name = 'tickets' and column_name in (
      'client_request_id',
      'tax_applies_to_delivery',
      'status',
      'voided_at',
      'void_reason',
      'voided_by'
    ))
    or (table_name = 'ticket_history' and column_name in ('actor_id', 'actor_label', 'created_at'))
  )
order by table_name, column_name;

select
  count(*) as legacy_items_with_unknown_loads
from public.ticket_items
where loads is null;

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'next_ticket_number',
    'is_admin',
    'is_admin_or_staff',
    'validate_ticket_payload',
    'create_ticket_atomic',
    'correct_ticket_atomic',
    'void_ticket'
  )
order by p.proname;

select
  has_function_privilege('anon', 'public.next_ticket_number()', 'EXECUTE')
    as anon_can_consume_mt_number,
  has_function_privilege('authenticated', 'public.next_ticket_number()', 'EXECUTE')
    as authenticated_can_consume_mt_number;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and policyname like 'phase05_%'
order by tablename, policyname;

select
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name like 'phase05_%'
order by event_object_table, trigger_name, event_manipulation;

select
  id,
  ticket_prefix,
  next_ticket_number,
  updated_at
from public.app_settings
order by id;
