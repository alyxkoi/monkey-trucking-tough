-- Ticket setup foundation preflight. READ ONLY.
-- Run in Lovable's managed Supabase SQL editor before applying
-- 20260827200000_ticket_setup_foundation.sql.

select id, ticket_prefix, next_ticket_number, tax_rate, tax_applies_to_delivery,
  delivery_tier_1_max_miles, delivery_tier_1_fee,
  delivery_tier_2_max_miles, delivery_tier_2_fee,
  delivery_tier_3_max_miles, delivery_tier_3_fee,
  delivery_overage_base_fee, delivery_overage_per_mile
from public.app_settings
order by id;

select id, name, price_per_yard, full_load_price, full_load_yards,
  is_active, sort_order, created_at, updated_at
from public.materials
order by sort_order, name;

select lower(btrim(name)) as normalized_name, count(*) as matching_rows,
  array_agg(id order by created_at, id) as material_ids
from public.materials
group by lower(btrim(name))
having count(*) > 1
order by normalized_name;

select id, name, is_active, created_at, updated_at
from public.drivers
order by is_active desc, name;

select
  count(*) as ticket_count,
  count(*) filter (where driver_id is null) as unassigned_ticket_count,
  count(*) filter (where tax_applies_to_delivery is null) as legacy_unknown_tax_on_delivery,
  min(ticket_number) as first_ticket_number,
  max(ticket_number) as latest_ticket_number
from public.tickets;

select
  count(*) as ticket_item_count,
  count(*) filter (where loads is null) as legacy_unknown_material_load_count,
  count(*) filter (where loads is not null) as explicit_material_load_count
from public.ticket_items;

