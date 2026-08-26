-- Phase 05 Ticket safety preservation gate.
-- READ ONLY. Run through Lovable's managed Supabase workflow before applying
-- the matching migration. Save the results with the deployment record.

select
  current_database() as database_name,
  current_setting('server_version') as postgres_version,
  now() as captured_at;

select
  table_schema,
  table_name,
  column_name,
  ordinal_position,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'app_settings',
    'drivers',
    'materials',
    'ticket_items',
    'tickets',
    'user_roles'
  )
order by table_name, ordinal_position;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'app_settings',
    'drivers',
    'materials',
    'ticket_items',
    'tickets',
    'user_roles'
  )
order by tablename, policyname;

select pg_get_functiondef('public.next_ticket_number()'::regprocedure)
  as next_ticket_number_definition;

select
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'next_ticket_number'
order by grantee, privilege_type;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('app_settings', 'drivers', 'materials', 'ticket_items', 'tickets', 'user_roles')
order by tablename, indexname;

select
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('app_settings', 'drivers', 'materials', 'ticket_items', 'tickets', 'user_roles')
order by event_object_table, trigger_name, event_manipulation;

select
  id,
  ticket_prefix,
  next_ticket_number,
  tax_rate,
  tax_applies_to_delivery,
  delivery_tier_1_max_miles,
  delivery_tier_1_fee,
  delivery_tier_2_max_miles,
  delivery_tier_2_fee,
  delivery_tier_3_max_miles,
  delivery_tier_3_fee,
  delivery_overage_base_fee,
  delivery_overage_per_mile,
  print_method,
  print_copies,
  updated_at
from public.app_settings
order by id;

select
  id,
  name,
  price_per_yard,
  full_load_price,
  full_load_yards,
  is_active,
  sort_order,
  updated_at
from public.materials
order by sort_order, name;

select
  count(*) as role_rows,
  count(*) filter (where role = 'admin') as admin_rows,
  count(*) filter (where role = 'staff') as staff_rows
from public.user_roles;

select
  count(*) as ticket_count,
  min(ticket_number) as earliest_ticket_number,
  max(ticket_number) as latest_ticket_number,
  min(created_at) as earliest_ticket_at,
  max(created_at) as latest_ticket_at
from public.tickets;

select ticket_number, count(*) as duplicate_count
from public.tickets
group by ticket_number
having count(*) > 1
order by ticket_number;

-- Representative legacy fixtures without customer contact details.
select
  t.id,
  t.ticket_number,
  t.created_at,
  t.delivery_type,
  t.delivery_miles,
  t.delivery_fee_per_load,
  t.load_count as delivery_load_count,
  t.materials_subtotal,
  t.tax_rate,
  t.tax_amount,
  t.delivery_total,
  t.grand_total,
  jsonb_agg(
    jsonb_build_object(
      'id', ti.id,
      'material_id', ti.material_id,
      'material_name', ti.material_name,
      'yards', ti.yards,
      'is_full_load', ti.is_full_load,
      'rate_used', ti.rate_used,
      'line_total', ti.line_total
    ) order by ti.created_at, ti.id
  ) as item_snapshots
from public.tickets t
join public.ticket_items ti on ti.ticket_id = t.id
group by t.id
order by t.created_at desc
limit 5;
